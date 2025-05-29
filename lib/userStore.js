import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      isInitialized: false,
      initError: null,
      selectedUniversity: null, // Store selected university
      isFirstTimeUser: true, // Track first-time signup

      // Load user data from localStorage
      loadUser: async () => {
        try {
          set({ isInitialized: true, initError: null });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error loading user:', error);
          }
          set({ initError: error.message || 'Failed to load user data', isInitialized: true });
        }
      },

      // Set user data
      setUser: async (userData) => {
        try {
          set({ user: userData, isInitialized: true, initError: null, isFirstTimeUser: true });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error saving user:', error);
          }
        }
      },

      // Set selected university
      setUniversity: async (university) => {
        try {
          set({ selectedUniversity: university, isFirstTimeUser: false });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error saving university:', error);
          }
        }
      },

      // Clear user data
      clearUser: async () => {
        try {
          set({ user: null, selectedUniversity: null, initError: null, isFirstTimeUser: true });
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error clearing user:', error);
          }
        }
      },

      // Reset initialization error
      resetInitError: () => {
        set({ initError: null });
      },

      // Safe getters with initialization check
      getUserId: () => {
        const state = get();
        if (!state.isInitialized) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('User store not initialized. Call loadUser first.');
          }
          return null;
        }
        return state.user?.id ?? null;
      },

      getUserEmail: () => {
        const state = get();
        if (!state.isInitialized) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('User store not initialized. Call loadUser first.');
          }
          return null;
        }
        return state.user?.email ?? null;
      },

      getSelectedUniversity: () => {
        const state = get();
        if (!state.isInitialized) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('User store not initialized. Call loadUser first.');
          }
          return null;
        }
        return state.selectedUniversity ?? null;
      },

      // Helper to check if store is ready
      isReady: () => {
        const state = get();
        return state.isInitialized && !state.initError;
      },
    }),
    {
      name: 'user-storage', // Key for local storage
      storage: createJSONStorage(() => localStorage), // Use localStorage for web
      // For mobile, you can later switch to AsyncStorage:
      // storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useUserStore;