"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Crown, Sparkles, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { getServices} from "@/hooks/servicesHooks";
import dynamic from "next/dynamic";
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";
import SellerProfileSkeleton from "@/components/ui/SellerProfileSkeleton";
import Header from "@/components/Header";
const ListingCard = dynamic(() => import("@/components/ListingCard"), {
  loading: () => <ListingCardSkeleton />,
  ssr: false,
});

const SellerProfileCard = dynamic(
  () => import("@/components/SellerProfileCard"),
  {
    ssr: false,
  }
);


export default function MyShopPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser();
  const { subscriptions, limits, loading: subLoading } = useSubscription(currentUser?.uid);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProducts, setUserProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("products");

  // Get highest tier subscription badge
  const getSubscriptionBadge = () => {
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

  const badge = getSubscriptionBadge();

  // Handle authentication state
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        console.log("No authenticated user, redirecting to login");
        router.push("/login");
      } else {
        console.log("Authenticated user:", currentUser.uid);
      }
      setLoading(false);
    }
  }, [currentUser, authLoading, router]);

  const fetchUserProducts = async () => {
    if (!currentUser) return;
    const productQuery = query(
      collection(db, "products"),
      where("userId", "==", currentUser.uid)
    );
    const productDocs = await getDocs(productQuery);
    return productDocs.docs.map((doc) => ({
      id: doc.id,
      product: { ...doc.data(), id: doc.id },
    }));
  };

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const products = await fetchUserProducts();
        if (isActive) setUserProducts(products);
      } catch (err) {
        toast.error("Failed to fetch products");
      }
    };
    if (currentUser) load();
    return () => {
      isActive = false;
    };
  }, [currentUser]);

  if (loading || authLoading) {
    return (
      <div className="p-4 bg-white min-h-screen">
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
        <Header title={"My Shop"} />

        {/* Profile Section */}
        <div className="mt-8 mb-8">
          <SellerProfileCard userProfile={currentUser} subscriptionBadge={badge} />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Button 
              onClick={() => router.push("/product-upload")} 
              className="text-white shadow-sm"
              style={{ backgroundColor: 'rgb(37,99,235)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
            
            <Button 
              onClick={() => router.push("/service-upload")} 
              variant="outline"
              className="border-gray-300 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>
        {/* Tabs Section */}
      <Tabs
        defaultValue="products"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="w-full md:w-auto mb-8 bg-gray-100 p-1 rounded-lg grid grid-cols-4 md:inline-flex">
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
            value="sales"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all text-sm"
          >
            Sales
          </TabsTrigger>
          <TabsTrigger 
            value="purchases"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all text-sm"
          >
            Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-0">
          {loading || refreshing ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : userProducts.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{userProducts.length}</span> product{userProducts.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {userProducts.map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/product-upload?id=${item.id}`)}
                  >
                    <ListingCard product={item.product} btnName="Edit" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
              <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No products yet</h3>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
                Start selling by adding your first product. It only takes a few minutes!
              </p>
              <Button
                onClick={() => router.push("/product-upload")}
                title="Add new product"
                className="text-white shadow-sm"
                style={{ backgroundColor: 'rgb(37,99,235)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Button>
            </div>
          )}
        </TabsContent>

{/* service implementation. can move to a separate component file  */}
        <TabsContent value="services" className="mt-0">
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
              <Sparkles className="h-8 w-8" style={{ color: 'rgb(37,99,235)' }} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Services Coming Soon</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Service listings will be available soon. Stay tuned!
            </p>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="mt-0">
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sales Yet</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Your sales history will appear here once you make your first sale.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="purchases" className="mt-0">
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
            <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
              <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Purchases Yet</h3>
            <p className="text-sm text-gray-500 text-center max-w-sm">
              Your purchase history will appear here once you buy your first item.
            </p>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
