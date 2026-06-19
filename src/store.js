import { create } from 'zustand';
import { db, auth, isTestMode } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';

// Where a user's data lives after the public/private split:
//   users/{uid}                  -> public leaderboard fields (no visited LIST)
//   users/{uid}/private/visited  -> the visited list, owner-only (gated by rules)
const privateVisitedRef = (uid) => doc(db, 'users', uid, 'private', 'visited');

export const useStore = create((set, get) => ({
  user: isTestMode ? auth.currentUser : null,
  // Username and profile image are mirrored from the Firestore user doc so the
  // UI updates live when they change (the Firebase auth user object is mutated
  // in place by updateProfile and won't trigger a re-render on its own).
  username: isTestMode ? auth.currentUser?.displayName || null : null,
  profileImage: null,
  visitedPlaces: new Set(),
  loading: true,
  authModalOpen: false,
  // True only while an account is mid-deletion, so the auth-doc snapshot listener
  // below doesn't resurrect the user doc we're deleting (that race left orphaned
  // 0% entries on the leaderboard).
  deletingAccount: false,
  audioMuted: typeof localStorage !== 'undefined' && localStorage.getItem('audioMuted') === 'true',

  setUser: (user) => set({ user }),
  setUsername: (username) => set({ username }),
  setProfileImage: (profileImage) => set({ profileImage }),
  setVisitedPlaces: (placesList) => set({ visitedPlaces: new Set(placesList), loading: false }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),
  setDeletingAccount: (deletingAccount) => set({ deletingAccount }),

  // Persist the chosen preset profile image (key = filename without extension,
  // or null to fall back to the monogram).
  updateProfileImage: async (key) => {
    const { user } = get();
    set({ profileImage: key }); // optimistic; snapshot will confirm
    if (!user || isTestMode) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { profileImage: key }, { merge: true });
    } catch (err) {
      console.error('Error saving profile image:', err);
    }
  },
  setAudioMuted: (muted) => {
    set({ audioMuted: muted });
    try { localStorage.setItem('audioMuted', String(muted)); } catch (_) {}
  },
  toggleAudioMuted: async () => {
    const { audioMuted, user } = get();
    const nextMuted = !audioMuted;
    set({ audioMuted: nextMuted });
    try { localStorage.setItem('audioMuted', String(nextMuted)); } catch (_) {}
    if (user && !isTestMode) {
      try {
        await setDoc(doc(db, 'users', user.uid), { audioMuted: nextMuted }, { merge: true });
      } catch (err) {
        console.error('Error saving mute setting:', err);
      }
    }
  },

  toggleVisited: async (placeId) => {
    const { visitedPlaces, user } = get();
    if (!user) return; // Must be logged in

    const newSet = new Set(visitedPlaces);
    if (newSet.has(placeId)) {
      newSet.delete(placeId);
    } else {
      newSet.add(placeId);
    }

    // Update local state
    set({ visitedPlaces: newSet });

    // Sync to backend if not in test mode
    if (!isTestMode) {
      try {
        // Public doc keeps only the count (for the leaderboard); the actual list
        // goes to the owner-only private doc.
        await setDoc(doc(db, 'users', user.uid), {
          username: user.displayName || 'Anonymous',
          visitedCount: newSet.size
        }, { merge: true });
        await setDoc(privateVisitedRef(user.uid), {
          visitedPlaces: Array.from(newSet)
        }, { merge: true });
      } catch (err) {
        console.error("Error syncing to Firestore:", err);
      }
    } else {
      console.log('Test mode: Local state updated:', Array.from(newSet));
    }
  }
}));

// Initialize Authentication state change listener
if (!isTestMode) {
  let unsubscribePublic = null;
  let unsubscribePrivate = null;

  const cleanupListeners = () => {
    if (unsubscribePublic) { unsubscribePublic(); unsubscribePublic = null; }
    if (unsubscribePrivate) { unsubscribePrivate(); unsubscribePrivate = null; }
  };

  onAuthStateChanged(auth, (firebaseUser) => {
    cleanupListeners();

    if (firebaseUser) {
      useStore.getState().setUser(firebaseUser);
      useStore.getState().setLoading(true);

      const userDocRef = doc(db, 'users', firebaseUser.uid);

      // Public doc: username + profile image. Also handles the one-time migration
      // of any legacy `visitedPlaces` that still lives on the public doc.
      unsubscribePublic = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          useStore.getState().setUsername(data.username || firebaseUser.displayName || null);
          useStore.getState().setProfileImage(data.profileImage || null);
          if (data.audioMuted !== undefined) {
            useStore.getState().setAudioMuted(data.audioMuted);
          }

          // Lazy migration: move a legacy public visited list into the private
          // doc, then strip it from the public doc so it stops being world-readable.
          if (Array.isArray(data.visitedPlaces)) {
            useStore.getState().setVisitedPlaces(data.visitedPlaces); // avoid a flash
            setDoc(privateVisitedRef(firebaseUser.uid), {
              visitedPlaces: data.visitedPlaces
            }, { merge: true })
              .then(() => updateDoc(userDocRef, {
                visitedPlaces: deleteField(),
                visitedCount: data.visitedPlaces.length,
              }))
              .catch((err) => console.error('Visited-list migration error:', err));
          }
        } else if (!useStore.getState().deletingAccount) {
          // First sign-in for this account: initialize the public doc (no list).
          // Skipped during account deletion so we don't resurrect the doc we're
          // deleting (which orphaned 0% leaderboard entries).
          setDoc(userDocRef, {
            username: firebaseUser.displayName || 'Anonymous',
            visitedCount: 0,
          }, { merge: true }).catch((err) => console.error("Error initializing user doc:", err));
          setDoc(privateVisitedRef(firebaseUser.uid), { visitedPlaces: [] }, { merge: true })
            .catch((err) => console.error('Error initializing private doc:', err));
          useStore.getState().setUsername(firebaseUser.displayName || null);
          useStore.getState().setProfileImage(null);
          useStore.getState().setVisitedPlaces([]);
        }
      }, (err) => {
        console.error("Firestore user doc error:", err);
        useStore.getState().setLoading(false);
      });

      // Private doc: the authoritative visited list for the signed-in user.
      unsubscribePrivate = onSnapshot(privateVisitedRef(firebaseUser.uid), (snap) => {
        if (snap.exists() && Array.isArray(snap.data().visitedPlaces)) {
          useStore.getState().setVisitedPlaces(snap.data().visitedPlaces);
        } else {
          useStore.getState().setLoading(false);
        }
      }, (err) => {
        console.error("Firestore private doc error:", err);
        useStore.getState().setLoading(false);
      });
    } else {
      useStore.getState().setUser(null);
      useStore.getState().setVisitedPlaces([]);
      useStore.getState().setUsername(null);
      useStore.getState().setProfileImage(null);
    }
  });
}
