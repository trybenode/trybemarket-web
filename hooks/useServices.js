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

export const useServices = (selectedCategory, itemsPerPage = 6) => {
  const [services, setServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [randomOffset, setRandomOffset] = useState(0);
  const lastDocRef = useRef(null);

  const selectedUniversity = useUserStore((state) =>
    state.getSelectedUniversity()
  );
  const isReady = useUserStore((state) => state.isReady());

  const fetchServices = useCallback(
    async (loadMore = false, refresh = false) => {
      if (!isReady || !selectedUniversity) {
        setError("No university selected or user store not ready");
        setInitialLoading(false);
        return;
      }

      try {
        if (loadMore) setIsFetchingMore(true);
        else if (refresh) setRefreshing(true);
        else setInitialLoading(true);

        let q = query(
          collection(db, "services"),
          where("university", "==", selectedUniversity)
        );

        // Use categoryId instead of category
        if (selectedCategory !== "All") {
          q = query(q, where("categoryId", "==", selectedCategory));
        }

        // Random ordering approach: randomly choose between ascending and descending
        const useAscending = Math.random() > 0.5;
        q = query(q, orderBy("createdAt", useAscending ? "asc" : "desc"));

        // Fetch more than needed for initial load, then shuffle
        const fetchSize = loadMore ? itemsPerPage : itemsPerPage * 3;
        q = query(q, limit(fetchSize));

        if (loadMore && lastDocRef.current) {
          q = query(q, startAfter(lastDocRef.current));
        }

        const querySnapshot = await getDocs(q);
        let batch = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        }));

        // For initial load, shuffle and take itemsPerPage
        if (!loadMore && batch.length > itemsPerPage) {
          batch = batch.sort(() => Math.random() - 0.5).slice(0, itemsPerPage);
        }

        lastDocRef.current =
          querySnapshot.docs[querySnapshot.docs.length - 1] ?? null;
        setHasMore(querySnapshot.docs.length === fetchSize);

        setServices((prev) => {
          if (!loadMore) return batch;
          const ids = new Set(prev.map((s) => s.id));
          return [...prev, ...batch.filter((s) => !ids.has(s.id))];
        });
      } catch (err) {
        setError(err.message);
        console.error("Error fetching services:", err);
      } finally {
        setInitialLoading(false);
        setIsFetchingMore(false);
        setRefreshing(false);
      }
    },
    [isReady, selectedUniversity, selectedCategory, itemsPerPage, randomOffset]
  );

  useEffect(() => {
    if (isReady && selectedUniversity) {
      lastDocRef.current = null;
      setServices([]);
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

  const refresh = useCallback(() => {
    lastDocRef.current = null;
    setHasMore(true);
    setRandomOffset(Math.random());
    fetchServices(false, true);
  }, [fetchServices]);

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
