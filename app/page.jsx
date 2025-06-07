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

const PAGE_SIZE = 6;

const sessionSeed = Math.random();
function shuffleWithSeed(arr, seed) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [shuffled, setShuffled] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false); // refresh dimmer
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSearch, setHasSearch] = useState(false);
  // const [lastDoc, setLastDoc] = useState(null);
  const lastDocRef = useRef(null);

  const selectedUniversity = useUserStore((s) => s.selectedUniversity);
  const storeReady = useUserStore((s) => s.isInitialized);

  // const fetchProducts = useCallback(
  //   async (loadMore = false, refresh = false) => {
  //     if (!storeReady) return;

  //     try {
  //       if (loadMore) setIsFetchingMore(true);
  //       else if (refresh) setRefreshing(true);
  //       else setLoading(true);

  //       /* Firestore query */
  //       const base = collection(db, "products");
  //       const constraints = [
  //         orderBy("createdAt", "desc"),
  //         limit(PAGE_SIZE),
  //       ];
  //       if (selectedUniversity)
  //         constraints.unshift(where("university", "==", selectedUniversity));
  //       if (loadMore && lastDoc) constraints.push(startAfter(lastDoc));

  //       const snap = await getDocs(query(base, ...constraints));
  //       const batch = snap.docs.map((d) => ({
  //         id: d.id,
  //         product: {
  //           ...d.data(),
  //           createdAt: d.data().createdAt?.toDate(),
  //           updatedAt: d.data().updatedAt?.toDate(),
  //         },
  //       }));

  //       setLastDoc(snap.docs.at(-1) ?? null);
  //       setHasMore(batch.length === PAGE_SIZE);

  //       setProducts((prev) => {
  //         if (!loadMore) return batch;
  //         const ids = new Set(prev.map((p) => p.id));
  //         return [...prev, ...batch.filter((p) => !ids.has(p.id))];
  //       });

  //       setShuffled((prev) => {
  //         if (!loadMore) return shuffleWithSeed(batch, sessionSeed);

  //         const prevIds = new Set(prev.map((p) => p.id));
  //         const fresh = batch.filter((p) => !prevIds.has(p.id));
  //         return fresh.length
  //           ? [...prev, ...shuffleWithSeed(fresh, sessionSeed)]
  //           : prev;
  //       });
  //     } catch (err) {
  //       console.error("fetchProducts failed:", err);
  //     } finally {
  //       setInitialLoading(false);
  //       setLoading(false);
  //       setIsFetchingMore(false);
  //       setRefreshing(false);
  //     }
  //   },
  //   [storeReady, selectedUniversity]
  // );

  // const prevUniversity = useRef(null);
  // useEffect(() => {
  //   if (!storeReady || selectedUniversity === prevUniversity.current) return;
  //   prevUniversity.current = selectedUniversity;
  //   setLastDoc(null);
  //   setHasMore(true);
  //   fetchProducts(false, true);
  // }, [selectedUniversity, storeReady, fetchProducts]);

  const fetchProducts = useCallback(
    async (loadMore = false, refresh = false) => {
      if (!storeReady) return;

      try {
        if (loadMore) setIsFetchingMore(true);
        else if (refresh) setRefreshing(true);
        else setLoading(true);

        const base = collection(db, "products");
        const constraints = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];

        if (selectedUniversity)
          constraints.unshift(where("university", "==", selectedUniversity));

        const currentLastDoc = loadMore ? lastDocRef.current : null;
        if (loadMore && currentLastDoc)
          constraints.push(startAfter(currentLastDoc));

        const snap = await getDocs(query(base, ...constraints));
        const batch = snap.docs.map((d) => ({
          id: d.id,
          product: {
            ...d.data(),
            createdAt: d.data().createdAt?.toDate(),
            updatedAt: d.data().updatedAt?.toDate(),
          },
        }));

        // ⚠️ Update ref instead of state
        lastDocRef.current = snap.docs.at(-1) ?? null;
        setHasMore(batch.length === PAGE_SIZE);

        setProducts((prev) => {
          if (!loadMore) return batch;
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...batch.filter((p) => !ids.has(p.id))];
        });

        setShuffled((prev) => {
          if (!loadMore) return shuffleWithSeed(batch, sessionSeed);
          const prevIds = new Set(prev.map((p) => p.id));
          const fresh = batch.filter((p) => !prevIds.has(p.id));
          return fresh.length
            ? [...prev, ...shuffleWithSeed(fresh, sessionSeed)]
            : prev;
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
    [storeReady, selectedUniversity]
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
    fetchProducts(false, true);
  };

  // const listToShow = hasSearch ? filtered : shuffled;
  const listToShow = useMemo(
    () => (hasSearch ? filtered : shuffled),
    [hasSearch, filtered, shuffled]
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
            <button
              onClick={onRefresh}
              className="mb-4 text-blue-500 underline"
            >
              Refresh
            </button>
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
