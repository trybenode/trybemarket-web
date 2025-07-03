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

      loadUser: async () => {
        try {
          set({ isInitialized: false });
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
              user: {
                ...get().user,
                fullName: userData.fullName || get().user.fullName,
                email: userData.email || get().user.email,
                profilePicture:
                  userData.profilePicture || get().user.profilePicture,
                isVerified: userData.isVerified || get().user.isVerified,
                emailVerified:
                  userData.emailVerified || get().user.emailVerified,
              },
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
          console.error("Error loading user from Firestore:", error);
          set({
            initError: error.message || "Failed to load user data",
            isInitialized: true,
          });
        }
      },

      setUser: async (userData) => {
        try {
          const userToStore = {
            id: userData.id,
            email: userData.email || "",
            fullName: userData.fullName || "",
            profilePicture: userData.profilePicture || "",
            isVerified: userData.isVerified || false,
            emailVerified: userData.emailVerified || false,
            phoneNumber: userData.phoneNumber || "",
            matricNumber: userData.matricNumber || "",
            address: userData.address || "",
            locationType: userData.locationType || "",
          };

          set({
            user: userToStore,
            isInitialized: false,
            initError: null,
          });

          await get().loadUser();
        } catch (error) {
          console.error("Error saving user:", error);
          set({ initError: error.message || "Failed to save user data" });
        }
      },

      setUniversity: async (university) => {
        try {
          const userId = get().user?.id;
          if (!userId) throw new Error("User not logged in");

          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, { selectedUniversity: university });

          set({ selectedUniversity: university });
        } catch (error) {
          console.error("Error saving university:", error);
          throw error;
        }
      },

      clearUser: async () => {
        set({
          user: null,
          selectedUniversity: null,
          initError: null,
          isInitialized: true,
        });
      },

      resetInitError: () => {
        set({ initError: null });
      },

      getUserId: () => {
        const state = get();
        if (!state.isInitialized) {
          console.warn("User store not initialized. Call loadUser first.");
          return null;
        }
        return state.user?.id ?? null;
      },

      getUserEmail: () => {
        const state = get();
        if (!state.isInitialized) {
          console.warn("User store not initialized. Call loadUser first.");
          return null;
        }
        return state.user?.email ?? null;
      },

      getUserFullName: () => {
        const state = get();
        if (!state.isInitialized) {
          console.warn("User store not initialized. Call loadUser first.");
          return null;
        }
        return state.user?.fullName ?? null;
      },

      getSelectedUniversity: () => {
        const state = get();
        if (!state.isInitialized) {
          console.warn("User store not initialized. Call loadUser first.");
          return null;
        }
        return state.selectedUniversity ?? null;
      },

      isReady: () => {
        const state = get();
        return state.isInitialized && !state.initError;
      },

      isFirstTimeUser: () => {
        const state = get();
        return state.isInitialized && !state.selectedUniversity;
      },
    }),
    {
      name: "user-storage",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : null
      ),
      partialize: (state) => ({
        user: state.user,
        selectedUniversity: state.selectedUniversity,
      }),
    }
  )
);

export default useUserStore;
