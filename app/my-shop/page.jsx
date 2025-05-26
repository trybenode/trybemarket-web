"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import ListingCard from "@/components/ListingCard";
import SellerProfileCard from "@/components/SellerProfileCard";

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

  // Fetch user products
  useEffect(() => {
    let isActive = true;
    const fetchProducts = async () => {
      if (!currentUser) return;
      try {
        console.log("Fetching products for user:", currentUser.uid);
        const productQuery = query(
          collection(db, "products"),
          where("userId", "==", currentUser.uid)
        );
        const productDocs = await getDocs(productQuery);
        if (isActive) {
          const products = productDocs.docs.map((doc) => ({
            id: doc.id,
            product: { ...doc.data(), id: doc.id },
          }));
          setUserProducts(products);
          console.log("User products fetched:", products);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        if (isActive) {
          toast.error(`Failed to fetch products: ${error.message}`);
        }
      }
    };
    fetchProducts();
    return () => {
      isActive = false;
    };
  }, [currentUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (!currentUser) {
        console.log("No authenticated user, redirecting to login");
        router.push("/login");
        return;
      }
      console.log("Refreshing products for user:", currentUser.uid);
      const productQuery = query(
        collection(db, "products"),
        where("userId", "==", currentUser.uid)
      );
      const productDocs = await getDocs(productQuery);
      const products = productDocs.docs.map((doc) => ({
        id: doc.id,
        product: { ...doc.data(), id: doc.id },
      }));
      setUserProducts(products);
      console.log("Refreshed products:", products);
      toast.success("Products refreshed successfully");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error(`Failed to refresh products: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Shop</h1>
        <div className="flex space-x-2">
         
          <Button onClick={() => router.push("/sell")}>
            <Plus className='h-4 w-4 mr-2' />
            Add Product
          </Button>
          <UserProfile/>
        </div>
      </div>

      <SellerProfileCard userProfile={currentUser} />

      <Tabs
        defaultValue='products'
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className='mb-6'>
          <TabsTrigger value='products'>My Products</TabsTrigger>
          <TabsTrigger value='sales'>Sales</TabsTrigger>
          <TabsTrigger value='purchases'>Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value='products'>
          {userProducts.length > 0 ? (
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              {userProducts.map((item) => (
                <div
                  key={item.id}
                  className='cursor-pointer'
                  onClick={() => router.push(`/sell?id=${item.id}`)}
                >
                  <ListingCard product={item.product} btnName='Edit' />
                </div>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-12 px-4'>
              <p className='text-lg text-gray-500 mb-4'>
                You haven't uploaded any products yet.
              </p>
              <Button onClick={() => router.push("/sell")}>
                <Plus className='h-4 w-4 mr-2' />
                Add New Product
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value='sales'>
          <div className='flex flex-col items-center justify-center py-12 px-4'>
            <p className='text-lg text-gray-500'>No sales history yet.</p>
          </div>
        </TabsContent>

        <TabsContent value='purchases'>
          <div className='flex flex-col items-center justify-center py-12 px-4'>
            <p className='text-lg text-gray-500'>No purchase history yet.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
