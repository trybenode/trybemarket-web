// import { useRouter } from "next/router";
// import { useState, useEffect } from "react";
// import { collection, query, where, getDocs } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import Image from "next/image";
// import Link from "next/link";

// import SellerProfileCard from "@/components/SellerProfileCard";
// import ListingCard from "@/components/ListingCard";
// import { Loader } from "lucide-react";

// export default function SellerShopPage() {
//   const router = useRouter();
//   const { sellerId } = router.query;

//   const [sellerInfo, setSellerInfo] = useState(null);
//   const [products, setProducts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   useEffect(() => {
//     const fetchSellerData = async () => {
//       if (!sellerId) return;
//       try {
//         const userQuery = query(collection(db, "users"), where("uid", "==", sellerId));
//         const userSnap = await getDocs(userQuery);

//         if (!userSnap.empty) {
//           const seller = userSnap.docs[0].data();
//           setSellerInfo(seller);

//           const fetchedProducts = await fetchSellerProducts(sellerId);
//           setProducts(fetchedProducts);
//         }
//       } catch (err) {
//         console.error("Error loading seller data:", err);
//       } finally {
//         setLoading(false);
//       }
//     };
//     fetchSellerData();
//   }, [sellerId]);

//   const fetchSellerProducts = async (id) => {
//     try {
//       const q = query(collection(db, "products"), where("userId", "==", id));
//       const snap = await getDocs(q);
//       return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
//     } catch (err) {
//       console.error("Error fetching Products:", err);
//       return [];
//     }
//   };

//   const handleRefresh = async () => {
//     if (!sellerId) return;
//     setRefreshing(true);
//     const freshProducts = await fetchSellerProducts(sellerId);
//     setProducts(freshProducts);
//     setRefreshing(false);
//   };

//   if (loading) return <Loader />;

//   return (
//     <div className="min-h-screen bg-white">
//       <div className="p-4">
//         <SellerProfileCard
//           sellerInfo={sellerInfo}
//           name={sellerInfo?.fullName || "Unknown Seller"}
//           yearCreated={sellerInfo?.yearCreated || "N/A"}
//           location={sellerInfo?.address || "Unknown Location"}
//           imageUrl={sellerInfo?.imageUrl || "/default-avatar.png"}
//         />

//         <div className="flex justify-between items-center mt-6 mb-2">
//           <h2 className="text-lg font-semibold">Products</h2>
//           <button
//             className="text-blue-600 hover:underline text-sm"
//             onClick={handleRefresh}
//             disabled={refreshing}
//           >
//             {refreshing ? "Refreshing..." : "Refresh"}
//           </button>
//         </div>

//         {products.length === 0 ? (
//           <p className="text-center text-gray-500 mt-6">
//             No other products found for {sellerInfo?.fullName || "this seller"}
//           </p>
//         ) : (
//           <div className="grid grid-cols-2 gap-4">
//             {products.map((product) => (
//               <Link
//                 key={product.id}
//                 href={{ pathname: `/listing/${product.id}`, query: { itemId: product.id } }}
//               >
//                 <div className="cursor-pointer">
//                   <ListingCard product={product} btnName="View" />
//                 </div>
//               </Link>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
// app/shop/page.jsx
// 'use client';

// import { useEffect, useState } from "react";
// import { collection, query, where, getDocs } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import Image from "next/image";
// import Link from "next/link";
// import SellerProfileCard from "@/components/SellerProfileCard";
// import ListingCard from "@/components/ListingCard";
// import { Loader } from "lucide-react";
// import { useSearchParams } from "next/navigation";

// export default function SellerShopPage() {
//   const searchParams = useSearchParams();
//   const sellerId = searchParams.get("sellerId");

//   const [sellerInfo, setSellerInfo] = useState(null);
//   const [products, setProducts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   useEffect(() => {
//     const fetchSellerData = async () => {
//       if (!sellerId) return;
//       try {
//         const userQuery = query(collection(db, "users"), where("uid", "==", sellerId));
//         const userSnap = await getDocs(userQuery);

//         if (!userSnap.empty) {
//           const seller = userSnap.docs[0].data();
//           setSellerInfo(seller);

//           const fetchedProducts = await fetchSellerProducts(sellerId);
//           setProducts(fetchedProducts);
//         }
//       } catch (err) {
//         console.error("Error loading seller data:", err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchSellerData();
//   }, [sellerId]);

//   const fetchSellerProducts = async (id) => {
//     try {
//       const q = query(collection(db, "products"), where("userId", "==", id));
//       const snap = await getDocs(q);
//       return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
//     } catch (err) {
//       console.error("Error fetching Products:", err);
//       return [];
//     }
//   };

//   const handleRefresh = async () => {
//     if (!sellerId) return;
//     setRefreshing(true);
//     const freshProducts = await fetchSellerProducts(sellerId);
//     setProducts(freshProducts);
//     setRefreshing(false);
//   };

//   if (loading) return <Loader />;

//   return (
//     <div className="min-h-screen bg-white">
//       <div className="p-4">
//         <SellerProfileCard
//           sellerInfo={sellerInfo}
//           name={sellerInfo?.fullName || "Unknown Seller"}
//           yearCreated={sellerInfo?.yearCreated || "N/A"}
//           location={sellerInfo?.address || "Unknown Location"}
//           imageUrl={sellerInfo?.profilePicture || "/default-avatar.png"}
//         />

//         <div className="flex justify-between items-center mt-6 mb-2">
//           <h2 className="text-lg font-semibold">Products</h2>
//           <button
//             className="text-blue-600 hover:underline text-sm"
//             onClick={handleRefresh}
//             disabled={refreshing}
//           >
//             {refreshing ? "Refreshing..." : "Refresh"}
//           </button>
//         </div>

//         {products.length === 0 ? (
//           <p className="text-center text-gray-500 mt-6">
//             No products found for {sellerInfo?.fullName || "this seller"}
//           </p>
//         ) : (
//           <div className="grid grid-cols-2 gap-4">
//             {products.map((product) => (
//               <Link
//                 key={product.id}
//                 href={{
//                   pathname: `/listing/${product.id}`,
//                   query: { itemId: product.id },
//                 }}
//               >
//                 <div className="cursor-pointer">
//                   <ListingCard product={product} btnName="View" />
//                 </div>
//               </Link>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// 'use client';

// import { useEffect, useState } from "react";
// import { useSearchParams } from "next/navigation";
// import { collection, query, where, getDocs } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import SellerProfileCard from "@/components/SellerProfileCard";
// import ListingCard from "@/components/ListingCard";
// import { Loader } from "lucide-react";
// import Link from "next/link";

// export default function SellerShopPage() {
//   const searchParams = useSearchParams();
//   const sellerId = searchParams.get("sellerId");

//   const [sellerInfo, setSellerInfo] = useState(null);
//   const [products, setProducts] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);

//   useEffect(() => {
//     const fetchSellerData = async () => {
//       if (!sellerId) return;

//       try {
//         // Fetch seller info
//         const userQuery = query(
//           collection(db, "users"),
//           where("uid", "==", sellerId)
//         );
//         const userSnap = await getDocs(userQuery);

//         if (!userSnap.empty) {
//           const seller = userSnap.docs[0].data();
//           setSellerInfo(seller);
//         }

//         // Fetch seller products
//         const productQuery = query(
//           collection(db, "products"),
//           where("userId", "==", sellerId)
//         );
//         const productSnap = await getDocs(productQuery);
//         const productList = productSnap.docs.map((doc) => ({
//           id: doc.id,
//           ...doc.data(),
//         }));
//         setProducts(productList);
//       } catch (err) {
//         console.error("Error loading seller or products:", err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchSellerData();
//   }, [sellerId]);

//   const handleRefresh = async () => {
//     if (!sellerId) return;
//     setRefreshing(true);
//     const productQuery = query(
//       collection(db, "products"),
//       where("userId", "==", sellerId)
//     );
//     const productSnap = await getDocs(productQuery);
//     const freshProducts = productSnap.docs.map((doc) => ({
//       id: doc.id,
//       ...doc.data(),
//     }));
//     setProducts(freshProducts);
//     setRefreshing(false);
//   };

//   if (loading) return <Loader className="animate-spin m-6" />;

//   return (
//     <div className="min-h-screen bg-white">
//       <div className="p-4">
//         {sellerInfo ? (
//           <SellerProfileCard sellerInfo={sellerInfo} />
//         ) : (
//           <p className="text-red-500">Seller not found</p>
//         )}

//         <div className="flex justify-between items-center mt-6 mb-2">
//           <h2 className="text-lg font-semibold">Products</h2>
//           <button
//             className="text-blue-600 hover:underline text-sm"
//             onClick={handleRefresh}
//             disabled={refreshing}
//           >
//             {refreshing ? "Refreshing..." : "Refresh"}
//           </button>
//         </div>

//         {products.length === 0 ? (
//           <p className="text-center text-gray-500 mt-6">
//             No products found for {sellerInfo?.fullName || "this seller"}
//           </p>
//         ) : (
//           <div className="grid grid-cols-2 gap-4">
//             {products.map((product) => (
//               <Link
//                 key={product.id}
//                 href={`/listing/${product.id}`}
//               >
//                 <div className="cursor-pointer">
//                   <ListingCard product={product} btnName="View" />
//                 </div>
//               </Link>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SellerProfileCard from "@/components/SellerProfileCard";
import ListingCard from "@/components/ListingCard";
import { Loader } from "lucide-react";
import Link from "next/link";
import UserProfile from "@/components/UserProfile";

export default function SellerShopPage({params}) {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("sellerId");
    const router = useRouter()
    const params = useParams()
    const sellerID= params.id

      // const router = useRouter();
      // const { id } = React.use(params);
      // const itemId = id || product?.id;

  const [sellerInfo, setSellerInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!sellerId) return;

      try {
        const userQuery = query(
          collection(db, "users"),
          where("uid", "==", sellerId)
        );
        const userSnap = await getDocs(userQuery);

        if (!userSnap.empty) {
          const seller = userSnap.docs[0].data();
          setSellerInfo(seller);
        }

        const productQuery = query(
          collection(db, "products"),
          where("userId", "==", sellerId)
        );
        const productSnap = await getDocs(productQuery);
        const productList = productSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productList);
      } catch (err) {
        console.error("Error loading seller or products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sellerId]);

  const handleRefresh = async () => {
    if (!sellerId) return;
    setRefreshing(true);
    const productQuery = query(
      collection(db, "products"),
      where("userId", "==", sellerId)
    );
    const productSnap = await getDocs(productQuery);
    const freshProducts = productSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setProducts(freshProducts);
    setRefreshing(false);
  };

  if (loading) return <Loader className="animate-spin m-6" />;

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4">
        <SellerProfileCard sellerInfo={sellerInfo} />

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
