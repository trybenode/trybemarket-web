"use client";

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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import ListingCards from "@/components/ListingCards";
import SearchBar from "@/components/SearchBar";
import UserProfile from "@/components/UserProfile";

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

  const fetchProducts = async (isLoadMore = false, isRefresh = false) => {
    try {
      if (isLoadMore) setIsFetchingMore(true);
      else if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const baseQuery = collection(db, "products");
      let q = query(baseQuery, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

      if (isLoadMore && lastVisible) {
        q = query(
          baseQuery,
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      }

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

  useEffect(() => {
    fetchProducts();
  }, []);

  const onRefresh = () => {
    setHasSearchQuery(false); // Reset search query to show all products
    setFilteredProducts([]); // Clear filtered products
    setLastVisible(null); // Reset pagination
    fetchProducts(false, true); // Fetch fresh data
  };

  const productsToDisplay = hasSearchQuery ? filteredProducts : products;

  return (
    <div className='flex flex-col min-h-screen max-w-6xl bg-white mx-auto'>
      <div className='flex items-center justify-between py-4 px-4 mb-6'>
        <Image
          src='/assets/logo.png?height=50&width=150'
          alt='Logo'
          width={150}
          height={40}
          className='object-contain'
        />
        <UserProfile />
      </div>

      <div className='flex-1 px-3'>
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
              if (!hasSearchQuery) fetchProducts(true);
            }}
            refreshControl={onRefresh}
            refreshing={refreshing}
          />
        ) : (
          <div className='flex flex-col items-center justify-center h-[50vh]'>
            <button
              onClick={onRefresh}
              className='mb-4 text-blue-500 hover:underline'
            >
              Refresh
            </button>
            <p className='mx-4 text-center text-lg text-red-500'>
              {hasSearchQuery
                ? "No products found"
                : "Please check your internet connection and refresh"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
