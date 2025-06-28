import { Heart } from "lucide-react";
import BackButton from "../components/BackButton";
import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import useFavoritesStore from "@/lib/FavouriteStore";

import {Button} from "../components/ui/button";

export default function ProductDetailsHeader({id, currentUserId}) {
  const [liked, setLiked] = useState(false);
    const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
    
  
useEffect(() => {
    if (id) {
      setLiked(favoriteIds.includes(id));
    }
  }, [id, favoriteIds]);
const handleLiked = () => {
    if (!currentUserId) {
      toast.error("Please login to add items to favorites", {
        duration: 4000,
        position: "top-right",
      });
      router.push("/login");
      return;
    }

    toggleFavorite(id);
    setLiked(!liked);
    toast.success(liked ? "Removed from favorites" : "Added to favorites", {
      duration: 2000,
      position: "top-right",
    });
  };
  return (
    <div className="mb-8 flex justify-between items-center">
      <BackButton />

      <h1 className="text-2xl font-bold text-gray-900">Listing Details </h1>
      <Button variant="ghost"  onClick={handleLiked}>
        <Heart
          className={`h-6 w-6 ${liked ? "fill-red-500 text-red-500" : ""}`}
        />
      </Button>
    </div>
  );
}
