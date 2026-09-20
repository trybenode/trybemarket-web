"use client";

import AppHeader from "@/components/AppHeader";
import FavoriteButton from "@/components/FavoriteButton";

/** Header for listing and service detail pages: back, title, favorite. */
export default function ProductDetailsHeader({ id, currentUserId, category = null, title = "Details" }) {
  return (
    <AppHeader
      back
      title={title}
      actions={<FavoriteButton id={id} currentUserId={currentUserId} category={category} />}
    />
  );
}
