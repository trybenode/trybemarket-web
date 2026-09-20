"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import ListingCard from "@/components/ListingCard";
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";

/**
 * "Hot daily sales": actively boosted products and services in a swipeable
 * strip. Fetching lives in the default export; BoostedCarouselView is the
 * presentation only (so it can be rendered with sample data). Hidden entirely
 * when nothing is currently boosted.
 */
export function BoostedCarouselView({ items, loading }) {
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + (direction === "left" ? -el.offsetWidth : el.offsetWidth) * 0.9, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="mb-5 rounded-3xl border border-brand-yellow-deep/30 bg-gradient-to-br from-brand-yellow-soft to-white p-3 md:p-4" aria-busy="true">
        <div className="mb-3 h-6 w-44 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-44 shrink-0 sm:w-48">
              <ListingCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-5 rounded-3xl border border-brand-yellow-deep/30 bg-gradient-to-br from-brand-yellow-soft via-white to-white p-3 shadow-sm md:p-4" aria-label="Hot daily sales">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-yellow text-slate-900">
            <Flame className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold text-slate-900 md:text-lg">Hot daily sales</h2>
          <Badge variant="muted">{items.length}</Badge>
        </div>
        <Button asChild variant="ghost" size="xs" className="text-slate-700">
          <Link href="/boosted-products">
            Show all <ChevronRight />
          </Link>
        </Button>
      </div>

      <div className="relative">
        {items.length > 3 && (
          <Button
            variant="outline"
            size="icon"
            className="absolute -left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white/95 shadow-md md:flex"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
          >
            <ChevronLeft />
          </Button>
        )}

        <div
          ref={scrollContainerRef}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const linkPath = item.type === "product" ? `/listing/${item.id}` : `/view-service/${item.id}`;
            return (
              <Link key={item.id} href={linkPath} className="block w-44 shrink-0 snap-start sm:w-48">
                <div className="h-full">
                  <ListingCard
                    product={item}
                    btnName="View"
                    overlay={
                      <>
                        <Badge variant="yellow" className="absolute bottom-2 left-2 shadow-sm">
                          <Zap className="h-3 w-3 fill-current" /> Boosted
                        </Badge>
                        {item.type === "service" && (
                          <Badge variant="muted" className="absolute bottom-2 right-2 bg-white/90 shadow-sm">
                            Service
                          </Badge>
                        )}
                      </>
                    }
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {items.length > 3 && (
          <Button
            variant="outline"
            size="icon"
            className="absolute -right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white/95 shadow-md md:flex"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
          >
            <ChevronRight />
          </Button>
        )}
      </div>
    </section>
  );
}

export default function BoostedProductsCarousel() {
  const [boostedItems, setBoostedItems] = useState([]);
  const [loading, setLoading] = useState(true);
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

  return <BoostedCarouselView items={boostedItems} loading={loading} />;
}
