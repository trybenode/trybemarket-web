"use client";
import React, {useEffect} from "react";
import UserProfile from "@/components/UserProfile";
import { useFavorites } from "@/hooks/FavouriteHook";
import ListingCard from "@/components/ListingCard";

export default function FavouritePage() {
  const { products, loading, isFetchingMore, fetchFavorites, loadMore } =
    useFavorites();

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Favourites</h1>
        <UserProfile />
      </div>

      {products?.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No favourite items yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products?.map((product) => (
            <ListingCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {isFetchingMore && (
        <div className="flex justify-center mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
