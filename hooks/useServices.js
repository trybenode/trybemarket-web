import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../lib/firebase";
import useUserStore from "../lib/userStore";
import {
  collection,
  query,
  where,
  limit,
  orderBy,
  startAfter,
  getDocs,
} from "firebase/firestore";

// Session seed for consistent shuffling
const sessionSeed = Math.random();

// Shuffle with seed
const shuffleWithSeed = (arr, seed) => {
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
};

export const useServices = (selectedCategory, itemsPerPage = 6) => {
  const [services, setServices] = useState([]);
  const [shuffledServices, setShuffledServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef(null);

  const selectedUniversity = useUserStore((state) =>
    state.getSelectedUniversity()
  );
  const isReady = useUserStore((state) => state.isReady());

  const fetchServices = useCallback(
    async (loadMore = false) => {
      if (!isReady || !selectedUniversity) {
        setError("No university selected or user store not ready");
        setInitialLoading(false);
        return;
      }

      try {
        if (loadMore) setIsFetchingMore(true);
        else setInitialLoading(true);

        let q = query(
          collection(db, "services"),
          where("university", "==", selectedUniversity)
        );

        // Use categoryId instead of category
        if (selectedCategory !== "All") {
          q = query(q, where("categoryId", "==", selectedCategory));
        }

        q = query(q, orderBy("createdAt", "desc"), limit(itemsPerPage));

        if (loadMore && lastDocRef.current) {
          q = query(q, startAfter(lastDocRef.current));
        }

        const querySnapshot = await getDocs(q);
        const batch = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        }));

        lastDocRef.current =
          querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;
        setHasMore(batch.length === itemsPerPage);

        setServices((prev) => {
          if (!loadMore) return batch;
          const ids = new Set(prev.map((s) => s.id));
          return [...prev, ...batch.filter((s) => !ids.has(s.id))];
        });

        setShuffledServices((prev) => {
          if (!loadMore) return shuffleWithSeed(batch, sessionSeed);
          const prevIds = new Set(prev.map((s) => s.id));
          const fresh = batch.filter((s) => !prevIds.has(s.id));
          return fresh.length
            ? [...prev, ...shuffleWithSeed(fresh, sessionSeed)]
            : prev;
        });
      } catch (err) {
        setError(err.message);
        console.error("Error fetching services:", err);
      } finally {
        setInitialLoading(false);
        setIsFetchingMore(false);
      }
    },
    [isReady, selectedUniversity, selectedCategory, itemsPerPage]
  );

  useEffect(() => {
    if (isReady && selectedUniversity) {
      lastDocRef.current = null;
      setServices([]);
      setShuffledServices([]);
      setHasMore(true);
      setError(null);
      fetchServices(false);
    }
  }, [isReady, selectedUniversity, selectedCategory, fetchServices]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingMore) {
      fetchServices(true);
    }
  }, [hasMore, isFetchingMore, fetchServices]);

  return {
    services: shuffledServices,
    initialLoading,
    isFetchingMore,
    error,
    hasMore,
    loadMore,
  };
};
