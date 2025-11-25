"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";

export default function BoostedProductsCarousel() {
  const [boostedItems, setBoostedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    fetchBoostedItems();
  }, []);

  const fetchBoostedItems = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      
      // Query products with active boosts (max 10)
      const productsQuery = query(
        collection(db, "products"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc"),
        limit(10)
      );

      // Query services with active boosts (max 10)
      const servicesQuery = query(
        collection(db, "services"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc"),
        limit(10)
      );

      const [productsSnap, servicesSnap] = await Promise.all([
        getDocs(productsQuery),
        getDocs(servicesQuery)
      ]);

      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        type: "product",
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        boostEndDate: doc.data().boostEndDate?.toDate(),
      }));

      const services = servicesSnap.docs.map(doc => ({
        id: doc.id,
        type: "service",
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        boostEndDate: doc.data().boostEndDate?.toDate(),
      }));

      // Combine and shuffle for variety, limit to 10 total
      const combined = [...products, ...services]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      
      setBoostedItems(combined);
    } catch (error) {
      console.error("Error fetching boosted items:", error);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.offsetWidth;
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 md:p-4 mb-4 border border-yellow-200">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-3"></div>
        <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (boostedItems.length === 0) {
    return null; // Don't show carousel if no boosted items
  }

  return (
    <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-3 md:p-4 mb-4 border border-yellow-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-600 fill-yellow-600" />
          <h2 className="text-base md:text-lg font-bold text-gray-900">
            🔥 Hot Daily Sales
          </h2>
          <Badge className="bg-yellow-600 text-white border-0 text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            {boostedItems.length}
          </Badge>
        </div>
        <Link href="/boosted-products">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-yellow-700 border-yellow-300 hover:bg-yellow-100 text-xs h-8"
          >
            Show All
          </Button>
        </Link>
      </div>

      {/* Horizontal Scroll Carousel */}
      <div className="relative">
        {/* Left Arrow */}
        {boostedItems.length > 3 && (
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border-yellow-300 rounded-full shadow-lg h-8 w-8"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Scrollable Container */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex gap-3 md:gap-4" style={{ width: 'max-content' }}>
            {boostedItems.map((item) => {
              const linkPath = item.type === "product" 
                ? `/listing/${item.id}` 
                : `/view-service/${item.id}`;

              return (
                <div key={item.id} className="relative" style={{ width: '200px', flexShrink: 0 }}>
                  <Link href={linkPath}>
                    <div className="relative">
                      {/* BOOST Badge - Top Left */}
                      <div className="absolute top-1 left-1 z-20">
                        <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-md text-[10px] px-1.5 py-0.5">
                          <Zap className="h-2.5 w-2.5 mr-0.5 fill-white" />
                          BOOST
                        </Badge>
                      </div>

                      {/* Type Badge - Top Right */}
                      <div className="absolute top-1 right-1 z-20">
                        <Badge variant="outline" className="bg-white/90 backdrop-blur-sm text-[10px] px-1.5 py-0.5 border-gray-300">
                          {item.type === "product" ? "Product" : "Service"}
                        </Badge>
                      </div>

                      <ListingCard product={item} btnName="View" />
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
        {boostedItems.length > 3 && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white border-yellow-300 rounded-full shadow-lg h-8 w-8"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Custom CSS to hide scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
