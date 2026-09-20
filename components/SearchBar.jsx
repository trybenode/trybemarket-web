"use client";

import React,{ useState, useEffect } from "react";
import { collection, getDocs, query as fsQuery, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { tokenizeText } from "@/lib/rankScoreShared";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const BROWSE_LIMIT = 60;
const SEARCH_LIMIT = 60;

// Ranked by rankScore desc, createdAt desc — same ordering every other
// surface uses (07-ranking-unification.md §6), replacing the old full
// unindexed collection scan.
async function fetchRankedBrowse() {
  const q = fsQuery(
    collection(db, "products"),
    orderBy("rankScore", "desc"),
    orderBy("createdAt", "desc"),
    limit(BROWSE_LIMIT)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    product: { ...doc.data(), createdAt: doc.data().createdAt?.toDate(), updatedAt: doc.data().updatedAt?.toDate() },
  }));
}

// Indexed on the FIRST query token via array-contains-any (Firestore's OR
// match across up to 10 values, already ordered by rankScore), then a
// client-side AND-filter over the remaining tokens on that bounded result
// set — not the whole collection. "Good enough for now," per the spec, not
// a real search engine.
async function fetchRankedSearch(tokens) {
  const q = fsQuery(
    collection(db, "products"),
    where("searchKeywords", "array-contains-any", tokens.slice(0, 10)),
    orderBy("rankScore", "desc"),
    orderBy("createdAt", "desc"),
    limit(SEARCH_LIMIT)
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((doc) => ({
    id: doc.id,
    product: { ...doc.data(), createdAt: doc.data().createdAt?.toDate(), updatedAt: doc.data().updatedAt?.toDate() },
  }));
  if (tokens.length <= 1) return docs;
  return docs.filter((d) => tokens.every((t) => (d.product.searchKeywords || []).includes(t)));
}

export default React.memo(function SearchBar({ onResults }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Debounce user input
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  useEffect(() => {
    const tokens = tokenizeText(debouncedQuery);

    const run = async () => {
      setLoading(true);
      try {
        if (tokens.length === 0) {
          const browse = await fetchRankedBrowse();
          onResults(browse, false);
          return;
        }

        const results = await fetchRankedSearch(tokens);

        // Track search event
        import('@/utils/analytics').then(({ trackEvent, EVENT_TYPES }) => {
          import('@/utils/session').then(({ getOrCreateSessionId }) => {
            import('@/lib/userStore').then((module) => {
              const useUserStore = module.default;
              trackEvent(EVENT_TYPES.SEARCH_PERFORMED, null, 'search', {
                query: debouncedQuery.trim().toLowerCase(),
                results_count: results.length,
                has_results: results.length > 0,
                campus_id: useUserStore.getState().selectedUniversity,
                session_id: getOrCreateSessionId(),
              });
            });
          });
        });

        onResults(results, true);
      } catch (error) {
        console.error("Error fetching search results:", error);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [debouncedQuery]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-400" />
      </div>
      <Input
        type="text"
        placeholder="Search products..."
        className="h-11 rounded-full border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-primary/30"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
})
