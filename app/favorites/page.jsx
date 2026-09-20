"use client";
import Link from "next/link";
import { useFavorites } from "@/hooks/FavouriteHook";
import ListingCard from "@/components/ListingCard";
import { Heart, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import FavoriteLoader from '@/components/ui/FavouriteLoader'
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { auth } from "../../lib/firebase";

export default function FavouritePage() {
  // Ensure the user is authenticated before rendering favorites
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const { products, services, loading } = useFavorites();
  const router = useRouter();

  if (loading) {
    return (
      <FavoriteLoader />
    );
  }

  const productCount = products?.length || 0;
  const serviceCount = services?.length || 0;
  const totalValue = (products || []).reduce((sum, product) => sum + (product.price || 0), 0);
  // Same grid as the marketplace and Explore Services.
  const gridClass = "mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Favorites" />

      <div className="container mx-auto max-w-6xl px-4 py-5">
        {productCount === 0 && serviceCount === 0 ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Heart className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No favorites yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Tap the heart on anything you like and it will be saved here for later.
            </p>
            <Button size="lg" className="mt-6" onClick={() => router.push("/")}>
              <ShoppingBag /> Browse marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {productCount > 0 && (
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Products <span className="text-sm font-semibold text-slate-400">{productCount}</span>
                  </h2>
                  <p className="text-sm text-slate-500">
                    Total value <span className="font-semibold text-slate-900">₦{totalValue.toLocaleString()}</span>
                  </p>
                </div>
                <div className={gridClass}>
                  {products.map((product) => (
                    <Link key={product.id} href={`/listing/${product.id}`} className="block h-full">
                      <ListingCard product={product} btnName="View" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {serviceCount > 0 && (
              <section>
                <h2 className="text-lg font-bold text-slate-900">
                  Services <span className="text-sm font-semibold text-slate-400">{serviceCount}</span>
                </h2>
                <div className={gridClass}>
                  {services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
