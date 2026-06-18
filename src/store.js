import { create } from 'zustand';
import { db, auth, isTestMode } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

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
  audioMuted: typeof localStorage !== 'undefined' && localStorage.getItem('audioMuted') === 'true',

  setUser: (user) => set({ user }),
  setUsername: (username) => set({ username }),
  setProfileImage: (profileImage) => set({ profileImage }),
  setVisitedPlaces: (placesList) => set({ visitedPlaces: new Set(placesList), loading: false }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),

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
  toggleAudioMuted: () => set((state) => {
    const audioMuted = !state.audioMuted;
    try { localStorage.setItem('audioMuted', String(audioMuted)); } catch (_) { /* ignore */ }
    return { audioMuted };
  }),

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
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          username: user.displayName || 'Anonymous',
          visitedPlaces: Array.from(newSet),
          visitedCount: newSet.size
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
  let unsubscribeDoc = null;

  onAuthStateChanged(auth, (firebaseUser) => {
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }

    if (firebaseUser) {
      useStore.getState().setUser(firebaseUser);
      useStore.getState().setLoading(true);

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          useStore.getState().setVisitedPlaces(data.visitedPlaces || []);
          useStore.getState().setUsername(data.username || firebaseUser.displayName || null);
          useStore.getState().setProfileImage(data.profileImage || null);
        } else {
          // Document doesn't exist yet, initialize it
          setDoc(userDocRef, {
            username: firebaseUser.displayName || 'Anonymous',
            visitedPlaces: [],
            visitedCount: 0
          }, { merge: true }).catch(err => console.error("Error initializing user doc:", err));
          useStore.getState().setVisitedPlaces([]);
          useStore.getState().setUsername(firebaseUser.displayName || null);
          useStore.getState().setProfileImage(null);
        }
      }, (err) => {
        console.error("Firestore user doc error:", err);
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

