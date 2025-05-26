import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Zustand store for managing favorites
const useFavoritesStore = create((set, get) => ({
  favoriteIds: [],

  // Load favorites from AsyncStorage when the app starts
  loadFavorites: async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem("favorites");
      if (storedFavorites) {
        set({ favoriteIds: JSON.parse(storedFavorites) });
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  },

  // Toggle favorite status (add/remove item ID)
  toggleFavorite: async (id) => {
    const { favoriteIds } = get();
    let updatedFavorites;

    if (favoriteIds.includes(id)) {
      // Remove from favorites
      updatedFavorites = favoriteIds.filter((favId) => favId !== id);
    } else {
      // Add to favorites
      updatedFavorites = [...favoriteIds, id];
    }

    // Update Zustand
    set({ favoriteIds: updatedFavorites });

    // Store in AsyncStorage
    await AsyncStorage.setItem("favorites", JSON.stringify(updatedFavorites));
  },

  // Clear all favorite IDs
  clearFavorites: async () => {
    await AsyncStorage.removeItem("favorites");
    set({ favoriteIds: [] });
  },
}));


export default useFavoritesStore;