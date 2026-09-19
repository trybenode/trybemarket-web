import { useState, useEffect, useCallback, useRef } from "react";
import { auth } from "@/lib/firebase";

const PAGE_SIZE = 20;

/**
 * Mirrors useServices.js's hook contract (entries/loading flags/loadMore/
 * refresh), backed by GET /api/transactions instead of a direct Firestore
 * query — that endpoint merges creditLedger/pendingSpends/
 * subscriptionPayments/boostCredits server-side (pendingSpends is
 * Admin-SDK-only under firestore.rules, so this can't be a client-SDK read).
 * The endpoint's opaque cursor stands in for the raw Firestore doc ref used
 * elsewhere, since this is a merged in-memory result, not one collection.
 */
export function useTransactionHistory(userId) {
  const [entries, setEntries] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef(null);
  // The IntersectionObserver effect below tears down and recreates its
  // observer every time isFetchingMore changes, and a fresh observer fires
  // its callback immediately if the sentinel is still on-screen — so a
  // short list can trigger loadMore() again before the isFetchingMore STATE
  // update from the first call has actually re-rendered. React state is too
  // slow (batched/async) to guard against that; a ref is checked and set
  // synchronously, so a second call arriving in that window is a no-op
  // instead of re-fetching (and re-appending) the same page.
  const fetchInFlightRef = useRef(false);

  const fetchPage = useCallback(async (loadMore = false, refresh = false) => {
    const user = auth.currentUser;
    if (!user) {
      setInitialLoading(false);
      return;
    }
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    try {
      if (loadMore) setIsFetchingMore(true);
      else if (refresh) setRefreshing(true);
      else setInitialLoading(true);

      const idToken = await user.getIdToken();
      const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
      if (loadMore && cursorRef.current) params.set("cursor", cursorRef.current);

      const res = await fetch(`/api/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load transactions");

      cursorRef.current = data.cursor;
      setHasMore(data.hasMore);
      setEntries((prev) => {
        if (!loadMore) return data.entries;
        // Defense in depth beyond the in-flight guard above, matching the
        // dedup-by-id pattern hooks/useServices.js already uses for its own
        // loadMore appends.
        const existingIds = new Set(prev.map((e) => e.id));
        return [...prev, ...data.entries.filter((e) => !existingIds.has(e.id))];
      });
    } catch (err) {
      setError(err.message);
      console.error("Transaction history fetch error:", err);
    } finally {
      fetchInFlightRef.current = false;
      setInitialLoading(false);
      setIsFetchingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setInitialLoading(false);
      return;
    }
    cursorRef.current = null;
    setEntries([]);
    setHasMore(true);
    setError(null);
    fetchPage(false);
  }, [userId, fetchPage]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingMore) fetchPage(true);
  }, [hasMore, isFetchingMore, fetchPage]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    fetchPage(false, true);
  }, [fetchPage]);

  return { entries, initialLoading, isFetchingMore, refreshing, error, hasMore, loadMore, refresh };
}
