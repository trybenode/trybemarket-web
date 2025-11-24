"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SellerProfileCard from "@/components/SellerProfileCard";
import ListingCard from "@/components/ListingCard";
import Link from "next/link";
import SellerProfileSkeleton from "@/components/ui/SellerProfileSkeleton";
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ReviewCard from "@/components/ReviewCard"
import Header from "@/components/Header";
import { getServices } from "@/hooks/servicesHooks";
import ServiceCard from "@/components/ServiceCard";
import { Crown, Sparkles, Shield } from "lucide-react";

export default function SellerShopPage() {
  const params = useParams();
  // const sellerId = params?.sellerId;
  const sellerId = Array.isArray(params?.sellerId)
    ? params.sellerId[0]
    : params?.sellerId;

  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [subscriptionBadge, setSubscriptionBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");

  // Get subscription badge helper
  const getSubscriptionBadge = (subscriptions) => {
    if (!subscriptions) return null;

    // Check for VIP (highest tier)
    if (subscriptions.product?.planId === "product_vip" || subscriptions.service?.planId === "service_vip") {
      return {
        label: "VIP",
        icon: Crown,
        className: "bg-gradient-to-r from-yellow-400 to-amber-500 text-white",
      };
    }

    // Check for Premium
    if (subscriptions.product?.planId === "product_premium" || subscriptions.service?.planId === "service_premium") {
      return {
        label: "Premium",
        icon: Sparkles,
        className: "text-white",
        style: { backgroundColor: 'rgb(37,99,235)' }
      };
    }

    // Check for Bundle
    if (subscriptions.bundle?.planId?.includes("bundle")) {
      return {
        label: "Bundle",
        icon: Shield,
        className: "bg-gradient-to-r from-purple-500 to-indigo-500 text-white",
      };
    }

    // Default to Freemium
    return {
      label: "Freemium",
      icon: null,
      className: "bg-gray-100 text-gray-600 border border-gray-300",
    };
  };


  // Fetch seller info and products
  useEffect(() => {
    const fetchAllData = async () => {
      if (!sellerId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch sellerInfo
        const sellerRef = doc(db, "users", sellerId);
        const sellerSnap = await getDoc(sellerRef);
        if (!sellerSnap.exists()) throw new Error("Seller not found");
        console.log("Seller ID from route:", sellerId);

        const sellerData = {
          id: sellerSnap.id,
          uid: sellerSnap.id,
          ...sellerSnap.data(),
        };
        setSellerInfo(sellerData);

        // Fetch seller subscriptions (using the document ID as userId)
        const subscriptionRef = doc(db, "subscriptions", sellerId);
        const subsSnap = await getDoc(subscriptionRef);
        
        const subscriptions = { product: null, service: null, bundle: null };
        
        if (subsSnap.exists()) {
          const data = subsSnap.data();
          subscriptions.product = data.product || null;
          subscriptions.service = data.service || null;
          subscriptions.bundle = data.bundle || null;
        }

        const badge = getSubscriptionBadge(subscriptions);
        setSubscriptionBadge(badge);

        // Fetch seller products
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("userId", "==", sellerId));
        const querySnapshot = await getDocs(q);
        const fetchedProducts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(fetchedProducts);

        const fetchedServices = await getServices(sellerId);
        setServices(fetchedServices);
      } catch (error) {
        console.error("Error fetching shop data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="p-4 min-h-screen mx-auto max-w-6xl">
        <div className="mb-4">
          <SellerProfileSkeleton />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Header title={"Seller's Shop"}/>
        
        {/* Profile Section */}
        <div className="mt-8 mb-8">
          {sellerInfo ? (
            <SellerProfileCard sellerInfo={sellerInfo} subscriptionBadge={subscriptionBadge} />
          ) : (
            <p className="text-red-500 text-center">Seller not found</p>
          )}
        </div>

        {/* Tabs Section */}
        <Tabs
          defaultValue="products"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full md:w-auto mb-8 bg-gray-100 p-1 rounded-lg grid grid-cols-3 md:inline-flex">
            <TabsTrigger 
              value="products"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all text-sm"
            >
              Products
            </TabsTrigger>
            <TabsTrigger 
              value="services"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all text-sm"
            >
              Services
            </TabsTrigger>
            <TabsTrigger 
              value="review"
              className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all text-sm"
            >
              Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  This seller hasn't listed any products yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <Link key={product.id} href={`/listing/${product.id}`}>
                    <div className="cursor-pointer">
                      <ListingCard product={product} btnName="View" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="services" className="mt-0">
            {services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                  <Sparkles className="h-8 w-8" style={{ color: 'rgb(37,99,235)' }} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No services yet</h3>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  This seller hasn't listed any services yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {services.map((service) => (
                  <Link key={service.id} href={`/view-service/${service.id}`}>
                    <div className="cursor-pointer">
                      <ServiceCard key={service.id} service={service} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="review" className="mt-0">
            <ReviewCard sellerId={sellerId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}