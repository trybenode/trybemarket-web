import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      isInitialized: false,
      initError: null,
      selectedUniversity: null,

      // Load user data from Firestore and sync with localStorage
      loadUser: async () => {
        try {
          const user = get().user;
          if (!user?.id) {
            set({ isInitialized: true, initError: null });
            return;
          }

          const userRef = doc(db, "users", user.id);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const userData = userSnap.data();
            set({
              selectedUniversity: userData.selectedUniversity || null,
              isInitialized: true,
              initError: null,
            });
          } else {
            set({
              selectedUniversity: null,
              isInitialized: true,
              initError: null,
            });
          }
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error loading user from Firestore:", error);
          }
          set({
            initError: error.message || "Failed to load user data",
            isInitialized: true,
          });
        }
      },

      // Set user data
      setUser: async (userData) => {
        try {
          set({
            user: userData,
            isInitialized: false, // Reset to ensure loadUser triggers
            initError: null,
          });
          await get().loadUser(); // Fetch Firestore data to sync selectedUniversity
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error saving user:", error);
          }
          set({ initError: error.message || "Failed to save user data" });
        }
      },

      // Set selected university
      setUniversity: async (university) => {
        try {
          const userId = get().user?.id;
          if (!userId) throw new Error("User not logged in");

          // Update Firestore
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, { selectedUniversity: university });

          // Update state (will be persisted to localStorage)
          set({ selectedUniversity: university });
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("Error saving university:", error);
          }
          throw error;
        }
      },

      // Clear user data
      clearUser: async () => {
        try {
          set({
            user: null,
            selectedUniversity: null,
            initError: null,
            isInitialized: false,
          });
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

      getSelectedUniversity: () => {
        const state = get();
        if (!state.isInitialized) {
          if (process.env.NODE_ENV === "development") {
            console.warn("User store not initialized. Call loadUser first.");
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

      // Helper to check if user is first time (no selected university)
      isFirstTimeUser: () => {
        const state = get();
        return state.isInitialized && !state.selectedUniversity;
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        selectedUniversity: state.selectedUniversity,
      }),
    }
  )
);

export default useUserStore;
