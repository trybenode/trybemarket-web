"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "react-hot-toast";
import useFavoritesStore from "@/lib/FavouriteStore";
import { cn } from "@/lib/utils";

/**
 * Heart toggle for a listing. Updates instantly (the store call is optimistic)
 * and pops so the tap is visibly acknowledged. Signed-out visitors are sent to
 * login instead. (The previous version referenced `router` without ever
 * creating it, so this path threw for signed-out users.)
 */
export default function FavoriteButton({ id, currentUserId, category = null, className }) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [popping, setPopping] = useState(false);
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  useEffect(() => {
    if (id) setLiked(favoriteIds.includes(id));
  }, [id, favoriteIds]);

  const handleLiked = () => {
    if (!currentUserId) {
      toast.error("Please log in to save items to your favorites", { duration: 3000 });
      router.push("/login");
      return;
    }

    const isAdding = !liked;
    toggleFavorite(id);
    setLiked(isAdding);
    setPopping(true);
    setTimeout(() => setPopping(false), 250);
    toast.success(isAdding ? "Saved to favorites" : "Removed from favorites", { duration: 1800 });

    if (isAdding) {
      import("@/utils/analytics").then(({ trackEvent, EVENT_TYPES }) => {
        import("@/utils/session").then(({ getOrCreateSessionId }) => {
          import("@/lib/userStore").then((module) => {
            const useUserStore = module.default;
            trackEvent(EVENT_TYPES.FAVORITE_ADDED, id, "listing", {
              category,
              campus_id: useUserStore.getState().selectedUniversity,
              session_id: getOrCreateSessionId(),
            });
          });
        });
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleLiked}
      aria-pressed={liked}
      aria-label={liked ? "Remove from favorites" : "Save to favorites"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-slate-100 active:scale-90",
        className
      )}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-transform duration-200",
          liked ? "fill-rose-500 text-rose-500" : "text-slate-700",
          popping && "scale-125"
        )}
      />
    </button>
  );
}
