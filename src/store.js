import { create } from 'zustand';
import { db, auth, isTestMode } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const useStore = create((set, get) => ({
  user: isTestMode ? auth.currentUser : null,
  visitedPlaces: new Set(),
  loading: true,
  authModalOpen: false,

  setUser: (user) => set({ user }),
  setVisitedPlaces: (placesList) => set({ visitedPlaces: new Set(placesList), loading: false }),
  setLoading: (loading) => set({ loading }),
  setAuthModalOpen: (authModalOpen) => set({ authModalOpen }),

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
        } else {
          // Document doesn't exist yet, initialize it
          setDoc(userDocRef, {
            username: firebaseUser.displayName || 'Anonymous',
            visitedPlaces: [],
            visitedCount: 0
          }, { merge: true }).catch(err => console.error("Error initializing user doc:", err));
          useStore.getState().setVisitedPlaces([]);
        }
      }, (err) => {
        console.error("Firestore user doc error:", err);
        useStore.getState().setLoading(false);
      });
    } else {
      useStore.getState().setUser(null);
      useStore.getState().setVisitedPlaces([]);
    }
  });
}

