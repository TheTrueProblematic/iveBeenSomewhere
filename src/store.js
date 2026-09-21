import { create } from 'zustand';
import { db, auth, isTestMode } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteField, runTransaction } from 'firebase/firestore';
import {
  shouldInitializeUserDocs,
  isAuthoritativeVisitedSnapshot,
  shouldPersistToggle,
  mergeLegacyVisited,
} from './visitedSync';

// Where a user's data lives after the public/private split:
//   users/{uid}                  -> public leaderboard fields (no visited LIST)
//   users/{uid}/private/visited  -> the visited list, owner-only (gated by rules)
const privateVisitedRef = (uid) => doc(db, 'users', uid, 'private', 'visited');

// Create a user's docs ONLY when they genuinely don't exist yet.
//
// This runs in a transaction so the existence check is server-authoritative and
// atomic. It used to be a pair of `setDoc(..., { merge: true })` calls fired
// straight from the snapshot handler below, which destroyed a live account:
// `onSnapshot` raises an event from the local cache before the server answers,
// and with nothing cached for that document the SDK reports it as
// *non-existent* (`metadata.fromCache === true`). The handler read that as
// "brand new account" and merged `visitedCount: 0` / `visitedPlaces: []` over
// real data. Never write initial values without proving the doc is absent.
const ensureUserDocs = (firebaseUser) => runTransaction(db, async (tx) => {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const visitedRef = privateVisitedRef(firebaseUser.uid);

  // All reads must precede all writes in a Firestore transaction.
  const publicSnap = await tx.get(userDocRef);
  const visitedSnap = await tx.get(visitedRef);

  const existingList = visitedSnap.exists() && Array.isArray(visitedSnap.data().visitedPlaces)
    ? visitedSnap.data().visitedPlaces
    : null;

  if (!publicSnap.exists()) {
    // Seed the count from whatever the private list already holds, so a
    // half-created account can never surface as 0% on the leaderboard.
    tx.set(userDocRef, {
      username: firebaseUser.displayName || 'Anonymous',
      visitedCount: existingList ? existingList.length : 0,
    }, { merge: true });
  }
  if (!visitedSnap.exists()) {
    tx.set(visitedRef, { visitedPlaces: [] });
  }
});

// Move a legacy public visited list into the private doc. The lists are UNIONed
// rather than replaced, so whichever copy is ahead, nothing is ever dropped.
const migrateLegacyVisited = (uid, legacyList) => runTransaction(db, async (tx) => {
  const userDocRef = doc(db, 'users', uid);
  const visitedRef = privateVisitedRef(uid);

  const visitedSnap = await tx.get(visitedRef);
  const current = visitedSnap.exists() && Array.isArray(visitedSnap.data().visitedPlaces)
    ? visitedSnap.data().visitedPlaces
    : [];
  const merged = mergeLegacyVisited(current, legacyList);

  tx.set(visitedRef, { visitedPlaces: merged }, { merge: true });
  tx.set(userDocRef, {
    visitedPlaces: deleteField(),
    visitedCount: merged.length,
  }, { merge: true });
});

export const useStore = create((set, get) => ({
  user: isTestMode ? auth.currentUser : null,
  // Username and profile image are mirrored from the Firestore user doc so the
  // UI updates live when they change (the Firebase auth user object is mutated
  // in place by updateProfile and won't trigger a re-render on its own).
  username: isTestMode ? auth.currentUser?.displayName || null : null,
  profileImage: null,
  visitedPlaces: new Set(),
  loading: true,
  // True once the AUTHORITATIVE visited list has arrived from the server for the
  // signed-in user. Until then `visitedPlaces` is just an empty placeholder, so
  // persisting anything derived from it would drop every real entry.
  visitedLoaded: isTestMode,
  authModalOpen: false,
  // True only while an account is mid-deletion, so the auth-doc snapshot listener
  // below doesn't resurrect the user doc we're deleting (that race left orphaned
  // 0% entries on the leaderboard).
  deletingAccount: false,
  audioMuted: typeof localStorage !== 'undefined' && localStorage.getItem('audioMuted') === 'true',

  setUser: (user) => set({ user }),
  setUsername: (username) => set({ username }),
  setProfileImage: (profileImage) => set({ profileImage }),
  setVisitedPlaces: (placesList) => set({
    visitedPlaces: new Set(placesList),
    loading: false,
    visitedLoaded: true,
  }),
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
    const { visitedPlaces, user, visitedLoaded } = get();
    if (!user) return; // Must be logged in
    // Refuse to write until the server's list has landed. Otherwise a toggle
    // during the load window would persist a one-item list over the real one —
    // the same class of bug as the init-on-cached-snapshot wipe above.
    if (!shouldPersistToggle({ hasUser: !!user, visitedLoaded })) return;

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
  let lastUid = null;

  const cleanupListeners = () => {
    if (unsubscribePublic) { unsubscribePublic(); unsubscribePublic = null; }
    if (unsubscribePrivate) { unsubscribePrivate(); unsubscribePrivate = null; }
  };

  onAuthStateChanged(auth, (firebaseUser) => {
    cleanupListeners();

    if (firebaseUser) {
      useStore.getState().setUser(firebaseUser);
      useStore.getState().setLoading(true);
      // A different account signed in: drop the previous user's list rather than
      // showing it until the new snapshot lands. Same uid (a re-fire for the
      // already-signed-in user) keeps its state so the UI doesn't flash.
      if (lastUid && lastUid !== firebaseUser.uid) {
        useStore.setState({ visitedPlaces: new Set() });
      }
      lastUid = firebaseUser.uid;
      // Nothing may be persisted for this user until their real list arrives.
      useStore.setState({ visitedLoaded: false });

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
          // The private-doc listener below owns local state; this only persists.
          if (Array.isArray(data.visitedPlaces)) {
            migrateLegacyVisited(firebaseUser.uid, data.visitedPlaces)
              .catch((err) => console.error('Visited-list migration error:', err));
          }
        } else if (shouldInitializeUserDocs({
          exists: false,
          fromCache: docSnap.metadata.fromCache,
          deletingAccount: useStore.getState().deletingAccount,
        })) {
          // The doc is absent ACCORDING TO THE SERVER, so this really is a first
          // sign-in: initialize the public doc (no list). A cache-only snapshot
          // is ignored — trusting one here previously wiped a live account.
          // Also skipped during account deletion so we don't resurrect the doc
          // we're deleting (which orphaned 0% leaderboard entries).
          ensureUserDocs(firebaseUser)
            .catch((err) => console.error('Error initializing user docs:', err));
          useStore.getState().setUsername(firebaseUser.displayName || null);
          useStore.getState().setProfileImage(null);
        }
      }, (err) => {
        console.error("Firestore user doc error:", err);
        useStore.getState().setLoading(false);
      });

      // Private doc: the authoritative visited list for the signed-in user.
      unsubscribePrivate = onSnapshot(privateVisitedRef(firebaseUser.uid), (snap) => {
        // Ignore the cache-only "not found" the SDK raises before the server
        // answers; only a server snapshot may mark the list as loaded.
        if (!isAuthoritativeVisitedSnapshot({
          exists: snap.exists(),
          fromCache: snap.metadata.fromCache,
        })) return;

        if (snap.exists() && Array.isArray(snap.data().visitedPlaces)) {
          useStore.getState().setVisitedPlaces(snap.data().visitedPlaces);
        } else {
          // Server-confirmed: this user genuinely has no list yet.
          useStore.getState().setVisitedPlaces([]);
        }
      }, (err) => {
        // Leave visitedLoaded false so nothing is persisted over data we
        // couldn't read.
        console.error("Firestore private doc error:", err);
        useStore.getState().setLoading(false);
      });
    } else {
      lastUid = null;
      useStore.getState().setUser(null);
      useStore.getState().setUsername(null);
      useStore.getState().setProfileImage(null);
      useStore.setState({ visitedPlaces: new Set(), visitedLoaded: false, loading: false });
    }
  });
}
