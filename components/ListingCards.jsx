"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import ListingCard from "./ListingCard"
import ListingCardSkeleton from "./ui/ListingCardSkeleton"
import Categories from "./Categories"

export default function ListingCards({
  products = [],
  isFetchingMore,
  loadMoreProducts,
  refreshControl,
  refreshing = false,
  isLoading = false,
}) {
  const router = useRouter()
  const [isAtBottom, setIsAtBottom] = useState(false)

  // Handle infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = document.documentElement.clientHeight

      // Check if user has scrolled to bottom
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        setIsAtBottom(true)
      } else {
        setIsAtBottom(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Load more products when user scrolls to bottom
  useEffect(() => {
    if (isAtBottom && loadMoreProducts && !isFetchingMore) {
      loadMoreProducts()
    }
  }, [isAtBottom, loadMoreProducts, isFetchingMore])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-gray-500 text-lg">No products found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Categories />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4">
        {products.map((item) => (
          <div key={item.id} className="mb-4">
            <div className="cursor-pointer" onClick={() => router.push(`/listing/${item.id}`)}>
              <ListingCard product={item.product} btnName="View" />
            </div>
          </div>
        ))}
      </div>

      {isFetchingMore && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {refreshing && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!isFetchingMore && products.length > 0 && (
        <button onClick={refreshControl} className="mx-auto my-4 text-blue-600 hover:underline">
          Refresh
        </button>
      )}
    </div>
  )
}
