"use client";
import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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
  const [error, setError] = useState(null);
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

        // Record shop view for the profile view counter (deduped server-side, per §4)
        import('@/utils/session').then(({ getOrCreateSessionId }) => {
          fetch('/api/shop-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sellerId,
              viewerId: auth.currentUser?.uid || null,
              sessionId: getOrCreateSessionId(),
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.counted) {
                setSellerInfo((prev) =>
                  prev ? { ...prev, shopViewCount: (prev.shopViewCount || 0) + 1 } : prev
                );
              }
            })
            .catch((error) => console.error('Error recording shop view:', error));
        });

        // Track shop visited event
        import('@/utils/analytics').then(({ trackEvent, EVENT_TYPES }) => {
          import('@/utils/session').then(({ getOrCreateSessionId }) => {
            trackEvent(EVENT_TYPES.SHOP_VISITED, sellerId, 'shop', {
              seller_id: sellerId,
              campus_id: sellerData.selectedUniversity,
              session_id: getOrCreateSessionId(),
              source: typeof document !== 'undefined' && document.referrer ? 'referral' : 'direct',
            });
          });
        });

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
        try {
          const productsRef = collection(db, "products");
          const q = query(productsRef, where("userId", "==", sellerId));
          const querySnapshot = await getDocs(q);
          const fetchedProducts = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setProducts(fetchedProducts);
        } catch (productError) {
          console.error("Error fetching products:", productError);
          setError("Unable to load products. This may be due to permission settings.");
        }

        // Fetch seller services
        try {
          const fetchedServices = await getServices(sellerId);
          setServices(fetchedServices);
        } catch (serviceError) {
          console.error("Error fetching services:", serviceError);
          setError("Unable to load services. This may be due to permission settings.");
        }
      } catch (error) {
        console.error("Error fetching shop data:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [sellerId]);

  if (!loading && error === "Seller not found") {
    notFound();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Seller's Shop" />
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
          <SellerProfileSkeleton />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Seller's Shop" />
      <div className="mx-auto max-w-6xl px-4 py-5">
        {/* Profile Section */}
        <div className="mb-5">
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
          <TabsList className="mb-5 grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
            <TabsTrigger 
              value="products"
              className="sm:min-w-32"
            >
              Products
            </TabsTrigger>
            <TabsTrigger 
              value="services"
              className="sm:min-w-32"
            >
              Services
            </TabsTrigger>
            <TabsTrigger 
              value="review"
              className="sm:min-w-32"
            >
              Reviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                  <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900">No products yet</h3>
                <p className="max-w-sm text-center text-sm text-slate-500">
                  This seller hasn't listed any products yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {products.map((product) => (
                  <Link key={product.id} href={`/listing/${product.id}`} className="block h-full">
                    <div className="h-full cursor-pointer">
                      <ListingCard product={product} btnName="View" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="services" className="mt-0">
            {services.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-1 text-lg font-bold text-slate-900">No services yet</h3>
                <p className="max-w-sm text-center text-sm text-slate-500">
                  This seller hasn't listed any services yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {services.map((service) => (
                  <Link key={service.id} href={`/view-service/${service.id}`} className="block h-full">
                    <div className="h-full cursor-pointer">
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