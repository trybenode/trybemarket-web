import { create } from "zustand";

const useUserStore = create((set, get) => ({
  user: null,
  isInitialized: false,
  initError: null,

  // Load user data from localStorage
  loadUser: async () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        set({ user: JSON.parse(storedUser), isInitialized: true, initError: null });
      } else {
        set({ isInitialized: true, initError: null });
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error loading user:", error);
      }
      set({ initError: error.message || "Failed to load user data" });
    }
  },

  // Set user data
  setUser: async (userData) => {
    try {
      localStorage.setItem("user", JSON.stringify(userData));
      set({ user: userData, isInitialized: true, initError: null });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error saving user:", error);
      }
    }
  },

  // Clear user data
  clearUser: async () => {
    try {
      localStorage.removeItem("user");
      set({ user: null, initError: null });
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error clearing user:", error);
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
      if (process.env.NODE_ENV === "development") {
        console.warn("User store not initialized. Call loadUser first.");
      }
      return null;
    }
    return state.user?.id ?? null;
  },

  getUserEmail: () => {
    const state = get();
    if (!state.isInitialized) {
      if (process.env.NODE_ENV === "development") {
        console.warn("User store not initialized. Call loadUser first.");
      }
      return null;
    }
    return state.user?.email ?? null;
  },

  // Helper to check if store is ready
  isReady: () => {
    const state = get();
    return state.isInitialized && !state.initError;
  },
}));

export default useUserStore;