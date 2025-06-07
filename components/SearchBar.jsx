"use client";

import React,{ useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default React.memo(function SearchBar({ onResults }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          product: {
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
            updatedAt: doc.data().updatedAt?.toDate(),
          },
        }));
        setProducts(data);
        onResults(data, false); // Load all by default
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Debounce user input
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      onResults(products, false);
      return;
    }

    const filtered = products.filter((prod) => {
      const item = prod.product;
      const q = debouncedQuery.toLowerCase();

      return (
        item.name?.toLowerCase().includes(q) ||
        item.categoryId?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        (Array.isArray(item.subcategory)
          ? item.subcategory.some((sub) => sub.toLowerCase().includes(q))
          : item.subcategory?.toLowerCase().includes(q)) ||
        item.description?.toLowerCase().includes(q)
      );
    });

    onResults(filtered, true);
  }, [debouncedQuery, products]);

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <Input
        type="text"
        placeholder="Search products..."
        className="pl-10 py-2 rounded-full border border-gray-300 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
})
