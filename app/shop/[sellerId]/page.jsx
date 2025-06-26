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

export default function SellerShopPage() {
  const params = useParams();
  // const sellerId = params?.sellerId;
  const sellerId = Array.isArray(params?.sellerId)
    ? params.sellerId[0]
    : params?.sellerId;

  const [products, setProducts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");


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

        // Fetch seller products
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("userId", "==", sellerId));
        const querySnapshot = await getDocs(q);
        const fetchedProducts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(fetchedProducts);
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
    <div className="min-h-screen mx-auto max-w-6xl bg-white">
      <Header title={"Seller's Shop"}/>
      <div className="p-2">
        {sellerInfo ? (
          <SellerProfileCard sellerInfo={sellerInfo} />
        ) : (
          <p className="text-red-500 text-center">Seller not found</p>
        )}

        
        <Tabs
          defaultValue="products"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-2">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="purchases">Service</TabsTrigger>
            <TabsTrigger value="review">Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {products.length === 0 ? (
              <div role="alert" className="text-center text-gray-500 mt-6">
                No products found for this seller.
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3 gap-4">
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
          <TabsContent value="review">
            <p>Sellers Rating</p>
            <ReviewCard  sellerId={sellerId}/>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
