"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

const ListingCards = dynamic(() => import("@/components/ListingCards"), {
  loading: () => (
    <div className="grid grid-cols-2 mt-5 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  ),
  ssr: false,
});

const SearchBar = dynamic(() => import("@/components/SearchBar"), {
  loading: () => <div className="h-12 bg-gray-100 rounded-md animate-pulse" />,
  ssr: false,
});
const UserProfile = dynamic(() => import("@/components/UserProfile"), {
  ssr: false,
});

const PAGE_SIZE = 8;

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasSearchQuery, setHasSearchQuery] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true); //used to stop endless loading when few products are uploaded
  const selectedUniversity = useUserStore((state) => state.selectedUniversity);
  const isUserStoreReady = useUserStore((state) => state.isInitialized);
  const [shuffledProducts, setShuffledProducts] = useState([]);

  const fetchProducts = async (isLoadMore = false, isRefresh = false) => {
    if (!isUserStoreReady) return; // wait for user store to initailize
    try {
      if (isLoadMore) setIsFetchingMore(true);
      else if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const baseQuery = collection(db, "products");

      let constraints = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
      console.log("Selected university:", selectedUniversity);
      if (selectedUniversity) {
        constraints.unshift(where("university", "==", selectedUniversity));
      }

      // let q = query(baseQuery, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
        // q = query(
        //   baseQuery,
        //   orderBy("createdAt", "desc"),
        //   startAfter(lastVisible),
        //   limit(PAGE_SIZE)
        // );
      }

      const q = query(baseQuery, ...constraints);

      const snap = await getDocs(q);
      const newProducts = snap.docs.map((doc) => ({
        id: doc.id,
        product: {
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        },
      }));

      // update lastVisible
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      setLastVisible(lastDoc);

      if (snap.docs.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);
      if (isLoadMore) setHasMore(true);

      setProducts((prev) => {
        if (!isLoadMore) return newProducts;
        // filter out duplicates
        const existingIds = new Set(prev.map((p) => p.id));
        const uniqueNew = newProducts.filter((p) => !existingIds.has(p.id));
        return [...prev, ...uniqueNew];
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
      setRefreshing(false);
    }
  };

  // useEffect(() => {
  //   fetchProducts();
  // }, []);

  // const onRefresh = () => {
  //   setHasSearchQuery(false); // Reset search query to show all products
  //   setFilteredProducts([]); // Clear filtered products
  //   setLastVisible(null); // Reset pagination
  //   fetchProducts(false, true); // Fetch fresh data
  // };

  useEffect(() => {
    if (isUserStoreReady) {
      setLastVisible(null); // Reset pagination
      setHasMore(true);
      fetchProducts(false, true); // Fetch fresh data
    }
    // fetchProducts();
  }, [selectedUniversity, isUserStoreReady]);

  const onRefresh = () => {
    setHasSearchQuery(false); // Reset search query to show all products
    setFilteredProducts([]); // Clear filtered products
    setLastVisible(null); // Reset pagination
    fetchProducts(false, true); // Fetch fresh data
  };

  //  Fisher-Yates algorithm
  function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  useEffect(() => {
    if (!hasSearchQuery && products.length > 0) {
      setShuffledProducts(shuffleArray(products));
    }
  }, [products, hasSearchQuery]);
  // const productsToDisplay = hasSearchQuery ? filteredProducts : products;
  const productsToDisplay = hasSearchQuery
    ? filteredProducts
    : shuffledProducts;

  return (
    <div className="flex flex-col min-h-screen max-w-6xl bg-white mx-auto">
      <div className="flex items-center justify-between py-4 px-4 mb-6">
        <Image
          src="/assets/logo.png?height=50&width=150"
          alt="Logo"
          width={150}
          height={40}
          className="object-contain"
        />
        <UserProfile />
      </div>

      <div className="flex-1 px-3">
        <SearchBar
          onResults={(results, isSearchActive) => {
            setFilteredProducts(results);
            setHasSearchQuery(isSearchActive);
          }}
        />

        {productsToDisplay.length > 0 || loading ? (
          <ListingCards
            products={productsToDisplay}
            isLoading={loading}
            isFetchingMore={isFetchingMore}
            loadMoreProducts={() => {
              if (!hasSearchQuery && hasMore) fetchProducts(true);
            }}
            refreshControl={onRefresh}
            refreshing={refreshing}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <button
              onClick={onRefresh}
              className="mb-4 text-blue-500 hover:underline"
            >
              Refresh
            </button>
            <p className="mx-4 text-center text-lg text-red-500">
              {/* {hasSearchQuery
                ? "No products found"
                : "Please check your internet connection and refresh"} */}
              {hasSearchQuery
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
