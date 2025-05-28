'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SellerProfileCard from "@/components/SellerProfileCard";
import ListingCard from "@/components/ListingCard";
import { Loader } from "lucide-react";
import Link from "next/link";

export default function SellerShopPage() {
  const params = useParams();
  const sellerId = params?.sellerId;

  const [products, setProducts] = useState([]);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

        const sellerData = { id: sellerSnap.id, uid: sellerSnap.id, ...sellerSnap.data() };
        setSellerInfo(sellerData);

        // Fetch seller products
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("userId", "==", sellerId));
        const querySnapshot = await getDocs(q);
        const fetchedProducts = querySnapshot.docs.map(doc => ({
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (!sellerId) return;
      const q = query(collection(db, "products"), where("userId", "==", sellerId));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <Loader className="animate-spin m-6 text-blue-500" />;

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4">
        {sellerInfo ? (
          <SellerProfileCard sellerInfo={sellerInfo} />
        ) : (
          <p className="text-red-500 text-center">Seller not found</p>
        )}

        <div className="flex justify-between items-center mt-6 mb-2">
          <h2 className="text-lg font-semibold">Products</h2>
          <button
            className="text-blue-600 hover:underline text-sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-center text-gray-500 mt-6">
            No products found for this seller.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              <Link key={product.id} href={`/listing/${product.id}`}>
                <div className="cursor-pointer">
                  <ListingCard product={product} btnName="View" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
