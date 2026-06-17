import { create } from 'zustand';
import { db, auth, isTestMode } from './firebase';

export const useStore = create((set, get) => ({
  user: isTestMode ? auth.currentUser : null,
  visitedPlaces: new Set(),
  loading: true,

  setUser: (user) => set({ user }),

  setVisitedPlaces: (placesList) => set({ visitedPlaces: new Set(placesList), loading: false }),

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
      // TODO: implement firestore sync
      console.log('Syncing to firestore not fully implemented for real mode');
    } else {
      console.log('Test mode: Local state updated:', Array.from(newSet));
    }
  }
}));
