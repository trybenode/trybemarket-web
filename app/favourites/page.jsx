import React from "react";
import { useFavoritesStore } from "@/lib/FavouriteStore";

export default function FavouritePage() {
  const { products, loading, isFetchingMore, fetchFavorites, loadMore } = useFavoritesStore();
  return <div>page</div>;
}
