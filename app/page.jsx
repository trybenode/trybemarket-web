"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
  startAfter,
  limit,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";
import CategoryBarSkeleton from "@/components/ui/CategoryBarSkeleton";
import useUserStore from "@/lib/userStore";

const Categories = dynamic(() => import("@/components/Categories"), {
  ssr: false,
  loading: () => <CategoryBarSkeleton />,
});

const ListingCards = dynamic(() => import("@/components/ListingCards"), {
  ssr: false,
  loading: () => null,
});

const SearchBar = dynamic(() => import("@/components/SearchBar"), {
  ssr: false,
  loading: () => <div className="h-12 bg-gray-100 rounded-md animate-pulse" />,
});

const ToolBar = dynamic(() => import("@/components/ToolBar"), {
  ssr: false,
  loading: () => <ToolBarSkeleton />,
});

const BoostedProductsCarousel = dynamic(
  () => import("@/components/BoostedProductsCarousel"),
  {
    ssr: false,
    loading: () => null,
  }
);

// 🔥 standard page size
const PAGE_SIZE = 6;

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearch, setHasSearch] = useState(false);

  const selectedUniversity = useUserStore((s) => s.selectedUniversity);
  const storeReady = useUserStore((s) => s.isInitialized);

  const lastDocRef = useRef(null);

  /**
   * ------------------------------------------
   * 🔥 TRUE INDUSTRY STANDARD FETCH (Pagination + Shuffle)
   * ------------------------------------------
   */
  const fetchProducts = useCallback(
    async (loadMore = false) => {
      if (!storeReady) return;

      try {
        if (loadMore) setIsFetchingMore(true);
        else setLoading(true);

        // Firestore ref
        const base = collection(db, "products");

        const constraints = [];

        // Optional filter
        if (selectedUniversity) {
          constraints.push(where("university", "==", selectedUniversity));
        }

        // Pure pagination ordering
        constraints.push(orderBy("createdAt", "desc"));
        constraints.push(limit(PAGE_SIZE));

        let q;

        if (loadMore && lastDocRef.current) {
          q = query(
            base,
            ...constraints.splice(0, constraints.length - 1),
            startAfter(lastDocRef.current),
            limit(PAGE_SIZE)
          );
        } else {
          q = query(base, ...constraints);
        }

        const snap = await getDocs(q);

        if (snap.empty) {
          setHasMore(false);
          return;
        }

        const docs = snap.docs.map((d) => ({
          id: d.id,
          product: {
            ...d.data(),
            createdAt: d.data().createdAt?.toDate(),
            updatedAt: d.data().updatedAt?.toDate(),
          },
        }));

        // 🔀 Apply randomness (perfect + cheap)
        const shuffled = docs.sort(() => Math.random() - 0.5);

        if (loadMore) {
          setProducts((prev) => [...prev, ...shuffled]);
        } else {
          setProducts(shuffled);
        }

        // save cursor
        lastDocRef.current = snap.docs.at(-1);

        // if exact page size loaded → means more still exist
        setHasMore(docs.length === PAGE_SIZE);
      } catch (err) {
        console.error("fetchProducts", err);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [storeReady, selectedUniversity]
  );

  /**
   * ------------------------------------------
   * 🔄 Initial Load
   * ------------------------------------------
   */
  useEffect(() => {
    if (storeReady) {
      lastDocRef.current = null;
      setHasMore(true);
      fetchProducts(false);
    }
  }, [storeReady, selectedUniversity, fetchProducts]);

  /**
   * ------------------------------------------
   * 🔄 Refresh
   * ------------------------------------------
   */
  const onRefresh = () => {
    setFiltered([]);
    setHasSearch(false);
    lastDocRef.current = null;
    setHasMore(true);
    setRefreshing(true);
    fetchProducts(false);
  };

  /**
   * ------------------------------------------
   * 🔍 Choose list to show
   * ------------------------------------------
   */
  const listToShow = useMemo(
    () => (hasSearch ? filtered : products),
    [hasSearch, filtered, products]
  );

  /**
   * ------------------------------------------
   * 🖼️ UI
   * ------------------------------------------
   */
  return (
    <div className="flex flex-col min-h-screen max-w-6xl bg-white mx-auto">
      <ToolBar />

      <div className="flex-1 px-3">
        <SearchBar
          onResults={(res, active) => {
            setFiltered(res);
            setHasSearch(active);
          }}
        />

        <Categories />

        <BoostedProductsCarousel />
        <div className="my-4 border-t border-gray-200" />

        <p className="text-gray-700 font-medium mb-3">All products</p>

        {initialLoading ? (
          <div className="grid grid-cols-2 mt-5 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listToShow.length ? (
          <ListingCards
            products={listToShow}
            isLoading={loading}
            isFetchingMore={isFetchingMore}
            loadMoreProducts={() => {
              if (!hasSearch && hasMore && !isFetchingMore) {
                fetchProducts(true);
              }
            }}
            refreshControl={onRefresh}
            refreshing={refreshing}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <p className="mx-4 text-center text-lg text-red-500">
              {hasSearch
                ? "No products found for this search."
                : selectedUniversity
                ? `No products in ${selectedUniversity} yet. Be the first to upload!`
                : "No products found. Please check your internet connection or try again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
