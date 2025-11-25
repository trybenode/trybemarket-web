"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export default function BoostedProductsCarousel() {
  const [boostedItems, setBoostedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchBoostedItems();
  }, []);

  const fetchBoostedItems = async () => {
    try {
      setLoading(true);
      
      // Get current date
      const now = new Date();
      
      // Query products with active boosts
      const productsQuery = query(
        collection(db, "products"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc"),
        limit(20)
      );

      // Query services with active boosts
      const servicesQuery = query(
        collection(db, "services"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc"),
        limit(20)
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

      // Combine and shuffle for variety
      const combined = [...products, ...services].sort(() => Math.random() - 0.5);
      setBoostedItems(combined);
    } catch (error) {
      console.error("Error fetching boosted items:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, boostedItems.length));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, boostedItems.length - 1) : prev - 1
    );
  };

  // Auto-advance carousel
  useEffect(() => {
    if (boostedItems.length <= 1) return;
    
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [boostedItems.length]);

  if (loading) {
    return (
      <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 mb-6 border border-yellow-200">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (boostedItems.length === 0) {
    return null; // Don't show carousel if no boosted items
  }

  const currentItem = boostedItems[currentIndex];
  const imageUri = Array.isArray(currentItem?.images) && currentItem.images.length > 0
    ? currentItem.images[0]?.url || currentItem.images[0]
    : currentItem?.image || null;

  return (
    <div className="w-full bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 md:p-6 mb-6 border border-yellow-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-600 fill-yellow-600" />
          <h2 className="text-lg md:text-xl font-bold text-gray-900">
            🔥 Hot Daily Sales
          </h2>
          <Badge className="bg-yellow-600 text-white border-0">
            <TrendingUp className="h-3 w-3 mr-1" />
            {boostedItems.length}
          </Badge>
        </div>
        <Link href="/boosted-products">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
          >
            Show All
          </Button>
        </Link>
      </div>

      {/* Carousel */}
      <div className="relative">
        <Card className="overflow-hidden border-2 border-yellow-300 shadow-lg">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Image Section */}
            <div className="relative h-64 md:h-80 bg-gray-100">
              {imageUri ? (
                <Image
                  src={imageUri}
                  alt={currentItem.name || "Boosted item"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-400">No Image</p>
                </div>
              )}
              
              {/* Badge Overlay */}
              <div className="absolute top-3 left-3">
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white border-0 shadow-md px-3 py-1">
                  <Zap className="h-4 w-4 mr-1 fill-white" />
                  BOOSTED
                </Badge>
              </div>
            </div>

            {/* Details Section */}
            <CardContent className="p-4 md:p-6 flex flex-col justify-between">
              <div>
                <Badge variant="outline" className="mb-2 text-xs">
                  {currentItem.type === "product" ? "Product" : "Service"}
                </Badge>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {currentItem.name || "Untitled"}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {currentItem.description || "No description available"}
                </p>
                
                {/* Price */}
                {currentItem.price != null && (
                  <div className="mb-4">
                    {currentItem.originalPrice && (
                      <p className="text-sm line-through text-gray-400">
                        ₦{formatNumber(currentItem.originalPrice)}
                      </p>
                    )}
                    <p className="text-3xl font-bold text-gray-900">
                      ₦{formatNumber(currentItem.price)}
                    </p>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <Link 
                href={currentItem.type === "product" 
                  ? `/listing/${currentItem.id}` 
                  : `/view-service/${currentItem.id}`}
              >
                <Button 
                  className="w-full text-white font-semibold"
                  style={{ backgroundColor: 'rgb(37,99,235)' }}
                  size="lg"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
                >
                  View Details
                </Button>
              </Link>
            </CardContent>
          </div>
        </Card>

        {/* Navigation Arrows */}
        {boostedItems.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-yellow-300 rounded-full shadow-lg"
              onClick={prevSlide}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border-yellow-300 rounded-full shadow-lg"
              onClick={nextSlide}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Dots Indicator */}
        {boostedItems.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {boostedItems.slice(0, 10).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex 
                    ? "w-6 bg-yellow-600" 
                    : "w-2 bg-yellow-300"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
