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
import useUserStore from "@/lib/userStore";
import ToolBarSkeleton from "@/components/ui/ToolBarSkeleton";
import CategoryBarSkeleton from "@/components/ui/CategoryBarSkeleton";
const Categories = dynamic(() => import("@/components/Categories"), {
  ssr: false,
  loading: () => <CategoryBarSkeleton />
  // loading: () => null,
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
const BoostedProductsCarousel = dynamic(() => import("@/components/BoostedProductsCarousel"), {
  ssr: false,
  loading: () => null,
});

const PAGE_SIZE = 6;

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearch, setHasSearch] = useState(false);
  const [randomOffset, setRandomOffset] = useState(0);
  const lastDocRef = useRef(null);

  const selectedUniversity = useUserStore((s) => s.selectedUniversity);
  const storeReady = useUserStore((s) => s.isInitialized);


  const fetchProducts = useCallback(
    async (loadMore = false, refresh = false) => {
      if (!storeReady) return;

      try {
        if (loadMore) setIsFetchingMore(true);
        else if (refresh) setRefreshing(true);
        else setLoading(true);

        const base = collection(db, "products");
        const constraints = [];

        // Add university filter if selected
        if (selectedUniversity) {
          constraints.push(where("university", "==", selectedUniversity));
        }

        // Random ordering approach:
        // 1. Randomly choose between ascending and descending
        // 2. Apply offset by skipping random number of documents
        const useAscending = Math.random() > 0.5;
        constraints.push(orderBy("createdAt", useAscending ? "asc" : "desc"));

        // For pagination, continue from last document
        const currentLastDoc = loadMore ? lastDocRef.current : null;
        if (loadMore && currentLastDoc) {
          constraints.push(startAfter(currentLastDoc));
        }

        // Fetch more than needed, then slice randomly
        const fetchSize = loadMore ? PAGE_SIZE : PAGE_SIZE * 3;
        constraints.push(limit(fetchSize));

        const snap = await getDocs(query(base, ...constraints));
        let batch = snap.docs.map((d) => ({
          id: d.id,
          product: {
            ...d.data(),
            createdAt: d.data().createdAt?.toDate(),
            updatedAt: d.data().updatedAt?.toDate(),
          },
        }));

        // For initial load, shuffle and take PAGE_SIZE
        if (!loadMore && batch.length > PAGE_SIZE) {
          batch = batch.sort(() => Math.random() - 0.5).slice(0, PAGE_SIZE);
        }

        // Update last document reference for pagination
        lastDocRef.current = snap.docs.at(-1) ?? null;
        setHasMore(snap.docs.length === fetchSize);

        setProducts((prev) => {
          if (!loadMore) return batch;
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...batch.filter((p) => !ids.has(p.id))];
        });
      } catch (err) {
        console.error("fetchProducts failed:", err);
      } finally {
        setInitialLoading(false);
        setLoading(false);
        setIsFetchingMore(false);
        setRefreshing(false);
      }
    },
    [storeReady, selectedUniversity, randomOffset]
  );

  useEffect(() => {
    if (storeReady) {
      lastDocRef.current = null;
      setHasMore(true);
      fetchProducts(false, true);
    }
  }, [selectedUniversity, storeReady, fetchProducts]);

  const onRefresh = () => {
    setHasSearch(false);
    setFiltered([]);
    lastDocRef.current = null;
    setHasMore(true);
    // Change random offset to get different results
    setRandomOffset(Math.random());
    fetchProducts(false, true);
  };

  const listToShow = useMemo(
    () => (hasSearch ? filtered : products),
    [hasSearch, filtered, products]
  );

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

        {/* Boosted Products Carousel */}
        <BoostedProductsCarousel />

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
              if (!hasSearch && hasMore && !isFetchingMore) fetchProducts(true);
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

