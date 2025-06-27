"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProducts, setUserProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("products");

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
      <div className="p-4">
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
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      <Header title={"My Shop"} />

      <SellerProfileCard userProfile={currentUser} />
      <Button onClick={() => router.push("/sell")} className="mb-2">
        <Plus className="h-4 w-4 mr-2" />
        Add Product
      </Button>
      <Tabs
        defaultValue="products"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="products">My Products</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {loading || refreshing ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : userProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {userProducts.map((item) => (
                <div
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/sell?id=${item.id}`)}
                >
                  <ListingCard product={item.product} btnName="Edit" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-lg text-gray-500 mb-4">
                You haven't uploaded any products yet.
              </p>
              <Button
                onClick={() => router.push("/sell")}
                title="Add new product"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Product
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sales">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <p className="text-lg text-gray-500">Coming Soon.</p>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <div className="flex flex-col items-center justify-center py-12 px-4">
            {/* <p className="text-lg text-gray-500">No purchase history yet.</p> */}
            <p className="text-lg text-gray-500">Coming Soon.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
