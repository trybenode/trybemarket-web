"use client";

import React, {  useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const ListingCard = dynamic(() => import("./ListingCard"), {
  loading: () => <ListingCardSkeleton />,
  ssr: false,
});


import ListingCardSkeleton from "./ui/ListingCardSkeleton";

export default React.memo(function ListingCards({
  products = [],
  isFetchingMore,
  loadMoreProducts,
  refreshControl,
  refreshing = false,
  isLoading = false,
}) {
  const router = useRouter();
  // useEffect(() => {
  //   const handleScroll = () => {
  //     const scrollTop = window.scrollY;
  //     const scrollHeight = document.documentElement.scrollHeight;
  //     const clientHeight = document.documentElement.clientHeight;

  //     // Check if user has scrolled to bottom
  //     if (scrollTop + clientHeight >= scrollHeight - 100) {
  //       setIsAtBottom(true);
  //     } else {
  //       setIsAtBottom(false);
  //     }
  //   };

  //   window.addEventListener("scroll", handleScroll);
  //   return () => window.removeEventListener("scroll", handleScroll);
  // }, []);
    const bottomRef = useRef(null)
// const bottomRef = useRef(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        loadMoreProducts &&
        !isFetchingMore &&
        !refreshing
      ) {
        loadMoreProducts();
      }
    },
    { rootMargin: "200px" }
  );

  const current = bottomRef.current;
  if (current) observer.observe(current);

  return () => {
    if (current) observer.unobserve(current);
  };
}, [loadMoreProducts, isFetchingMore, refreshing]);



  // A hook must run on EVERY render, so this sits above the early returns below.
  // It used to sit after them: when `isLoading` flipped to true while the list
  // was showing (a logout resets the campus filter and reloads; so does the
  // Refresh button), React saw fewer hooks than the previous render and threw
  // "Rendered fewer hooks than expected", blanking the whole app.
const productCards = useMemo(() => {
  return products.map((item) => (
    <div key={item.id}>
      <div
        className="h-full cursor-pointer"
        onClick={() => router.push(`/listing/${item.id}`)}
      >
        <ListingCard product={item.product} btnName="View" />
      </div>
    </div>
  ));
}, [products, router]);

  if (isLoading) {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 text-base">No products found</p>
      </div>
    );
  }



  return (
    <div className="flex flex-col">
     
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {productCards}
      </div>

      {(isFetchingMore || refreshing) && (
        <div className="flex justify-center my-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'rgb(37,99,235)' }}></div>
        </div>
      )}

      {!isFetchingMore && products.length > 0 && (
        <button
          onClick={refreshControl}
          className="mx-auto my-6 text-sm font-medium hover:underline"
          style={{ color: 'rgb(37,99,235)' }}
        >
          Refresh
        </button>
      )}
      <div ref={bottomRef}></div>
    </div>
  );
});
