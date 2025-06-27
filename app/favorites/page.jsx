"use client";
import UserProfile from "@/components/UserProfile";
import { Card } from "@/components/ui/card";
import { useFavorites } from "@/hooks/FavouriteHook";
import ListingCard from "@/components/ListingCard";
import { Heart, ShoppingBag } from "lucide-react";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Enhanced Header */}
        <Header title={"Favorites"}/>

        {/* Content */}
        {(!products || products.length === 0) && (!services || services.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 max-w-md w-full text-center">
              <div className="mb-6">
                <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Heart className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No favourites yet
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Start exploring and save items you love. Your favourite
                  products and services will appear here.
                </p>
              </div>
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Browse Marketplace
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Products Section */}
            {products && products.length > 0 && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {products.length}
                        </div>
                        <div className="text-sm text-gray-600">Saved Products</div>
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          ₦
                          {products
                            .reduce((sum, product) => sum + (product.price || 0), 0)
                            .toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Product Value</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {products.map((product, index) => (
                    <div
                      key={product.id}
                      className="transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animation: "fadeInUp 0.6s ease-out forwards",
                      }}
                      onClick={() => router.push(`/listing/${product.id}`)}
                    >
                      {/* <ListingCard product={product} /> */}
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Services Section */}
            {services && services.length > 0 && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {services.length}
                        </div>
                        <div className="text-sm text-gray-600">Saved Services</div>
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          ₦
                          {services
                            .reduce((sum, service) => sum + (service.price || 0), 0)
                            .toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Service Value</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {services.map((service, index) => (
                    <div
                      key={service.id}
                      className="transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animation: "fadeInUp 0.6s ease-out forwards",
                      }}
                      onClick={() => router.push(`/view-service/${service.id}`)}
                    >
                      <ServiceCard service={service} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
