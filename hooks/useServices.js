import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../lib/firebase";
import useUserStore from "../lib/userStore";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from "firebase/firestore";

export const useServices = (selectedCategory, itemsPerPage = 6) => {
  const [services, setServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const lastDocRef = useRef(null);

  const selectedUniversity = useUserStore((s) => s.getSelectedUniversity());
  const isReady = useUserStore((s) => s.isReady());

  const fetchServices = useCallback(
    async (loadMore = false, refresh = false) => {
      if (!isReady || !selectedUniversity) {
        setInitialLoading(false);
        return;
      }

      try {
        if (loadMore) setIsFetchingMore(true);
        else if (refresh) setRefreshing(true);
        else setInitialLoading(true);

        let q = query(
          collection(db, "services"),
          where("university", "==", selectedUniversity),
          orderBy("createdAt", "desc") // 🔥 NEVER random order for Firestore pagination
        );

        if (selectedCategory !== "All") {
          q = query(q, where("categoryId", "==", selectedCategory));
        }

        const fetchSize = loadMore ? itemsPerPage : itemsPerPage * 3;
        q = query(q, limit(fetchSize));

        if (loadMore && lastDocRef.current) {
          q = query(q, startAfter(lastDocRef.current));
        }

        const snap = await getDocs(q);
        let batch = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate(),
        }));

        // 🔥 Shuffle only during FIRST LOAD
        if (!loadMore) {
          batch = batch.sort(() => Math.random() - 0.5).slice(0, itemsPerPage);
        }

        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setHasMore(snap.docs.length === fetchSize);

        setServices((prev) => {
          if (!loadMore) return batch;
          const existing = new Set(prev.map((x) => x.id));
          return [...prev, ...batch.filter((b) => !existing.has(b.id))];
        });
      } catch (err) {
        setError(err.message);
        console.error("Service fetch error:", err);
      } finally {
        setInitialLoading(false);
        setIsFetchingMore(false);
        setRefreshing(false);
      }
    },
    [isReady, selectedUniversity, selectedCategory, itemsPerPage]
  );

  useEffect(() => {
    if (isReady && selectedUniversity) {
      lastDocRef.current = null;
      setServices([]);
      setHasMore(true);
      setError(null);
      fetchServices(false);
    }
  }, [isReady, selectedUniversity, selectedCategory]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingMore) fetchServices(true);
  }, [hasMore, isFetchingMore]);

  const refresh = useCallback(() => {
    lastDocRef.current = null;
    setServices([]);
    setHasMore(true);
    fetchServices(false, true);
  }, []);

  return {
    services,
    initialLoading,
    isFetchingMore,
    refreshing,
    error,
    hasMore,
    loadMore,
    refresh,
  };
};
