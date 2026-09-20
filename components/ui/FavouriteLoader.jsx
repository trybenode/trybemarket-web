import React from "react"
import Header from "@/components/Header"
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton"

export default function FavoriteLoader() {
  return (
    <div className="min-h-screen bg-slate-50" aria-busy="true">
      <Header title="Favorites" />
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
