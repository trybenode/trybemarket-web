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



  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4 transition-opacity duration-300 ease-in-out opacity-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-gray-500 text-lg">No products found</p>
      </div>
    );
  }


const productCards = useMemo(() => {
  return products.map((item) => (
    <div key={item.id} className="mb-4">
      <div
        className="cursor-pointer"
        onClick={() => router.push(`/listing/${item.id}`)}
      >
        <ListingCard product={item.product} btnName="View" />
      </div>
    </div>
  ));
}, [products, router]);

  return (
    <div className="flex flex-col">
     

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4">
        
        {productCards}
      </div>

      {(isFetchingMore || refreshing) && (
  <div className="flex justify-center my-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)}


      {!isFetchingMore && products.length > 0 && (
        <button
          onClick={refreshControl}
          className="mx-auto my-4 text-blue-600 hover:underline"
        >
          Refresh
        </button>
      )}
      <div ref={bottomRef}></div>
    </div>
  );
});
