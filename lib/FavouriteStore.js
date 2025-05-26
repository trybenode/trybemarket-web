import { create } from "zustand";
// Zustand store for managing favorites
const useFavoritesStore = create((set, get) => ({
  favoriteIds: [],

  // Load favorites from localStorage when the app starts
  loadFavorites: async () => {
    try {
      const storedFavorites = localStorage.getItem("favorites");
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

    // Store in localStorage
    localStorage.setItem("favorites", JSON.stringify(updatedFavorites));
  },

  // Clear all favorite IDs
  clearFavorites: async () => {
    localStorage.removeItem("favorites");
    set({ favoriteIds: [] });
  },
}));

export default useFavoritesStore;
