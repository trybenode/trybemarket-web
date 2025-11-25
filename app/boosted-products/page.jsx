"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Zap, TrendingUp, Package, Briefcase } from "lucide-react";
import Link from "next/link";
import Header from "@/components/Header";
import ListingCard from "@/components/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";

export default function BoostedProductsPage() {
  const [boostedProducts, setBoostedProducts] = useState([]);
  const [boostedServices, setBoostedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchBoostedItems();
  }, []);

  const fetchBoostedItems = async () => {
    try {
      setLoading(true);
      const now = new Date();

      // Fetch boosted products
      const productsQuery = query(
        collection(db, "products"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc")
      );

      // Fetch boosted services
      const servicesQuery = query(
        collection(db, "services"),
        where("boostEndDate", ">", now),
        where("isBoosted", "==", true),
        orderBy("boostEndDate", "desc")
      );

      const [productsSnap, servicesSnap] = await Promise.all([
        getDocs(productsQuery),
        getDocs(servicesQuery)
      ]);

      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        product: {
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          boostEndDate: doc.data().boostEndDate?.toDate(),
        }
      }));

      const services = servicesSnap.docs.map(doc => ({
        id: doc.id,
        service: {
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          boostEndDate: doc.data().boostEndDate?.toDate(),
        }
      }));

      setBoostedProducts(products);
      setBoostedServices(services);
    } catch (error) {
      console.error("Error fetching boosted items:", error);
    } finally {
      setLoading(false);
    }
  };

  const allItems = [...boostedProducts, ...boostedServices];

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Header title="Hot Daily Sales" />

        {/* Hero Section */}
        <div className="mt-6 mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-8 w-8 text-yellow-600 fill-yellow-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              🔥 Hot Daily Sales
            </h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base">
            Discover boosted products and services with maximum visibility. These listings get priority placement and top search rankings!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
              <p className="text-2xl font-bold text-gray-900">{allItems.length}</p>
            </div>
            <p className="text-xs text-gray-600">Total Boosted</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Package className="h-5 w-5" style={{ color: 'rgb(37,99,235)' }} />
              <p className="text-2xl font-bold text-gray-900">{boostedProducts.length}</p>
            </div>
            <p className="text-xs text-gray-600">Products</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold text-gray-900">{boostedServices.length}</p>
            </div>
            <p className="text-xs text-gray-600">Services</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md"
            >
              All ({allItems.length})
            </TabsTrigger>
            <TabsTrigger 
              value="products"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md"
            >
              Products ({boostedProducts.length})
            </TabsTrigger>
            <TabsTrigger 
              value="services"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md"
            >
              Services ({boostedServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : allItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allItems.map((item) => {
                  const isProduct = item.product;
                  const data = isProduct ? item.product : item.service;
                  const linkPath = isProduct ? `/listing/${item.id}` : `/view-service/${item.id}`;

                  return (
                    <Link key={item.id} href={linkPath}>
                      <div className="relative">
                        <Badge className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-md">
                          <Zap className="h-3 w-3 mr-1 fill-white" />
                          BOOST
                        </Badge>
                        <ListingCard product={data} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No boosted items available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="products">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : boostedProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {boostedProducts.map((item) => (
                  <Link key={item.id} href={`/listing/${item.id}`}>
                    <div className="relative">
                      <Badge className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-md">
                        <Zap className="h-3 w-3 mr-1 fill-white" />
                        BOOST
                      </Badge>
                      <ListingCard product={item.product} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No boosted products available</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="services">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : boostedServices.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {boostedServices.map((item) => (
                  <Link key={item.id} href={`/view-service/${item.id}`}>
                    <div className="relative">
                      <Badge className="absolute -top-2 -right-2 z-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-md">
                        <Zap className="h-3 w-3 mr-1 fill-white" />
                        BOOST
                      </Badge>
                      <ListingCard product={item.service} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No boosted services available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
