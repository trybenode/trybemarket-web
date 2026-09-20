"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { useSubscription } from "@/hooks/useSubscription";
import { isSubscriptionActive } from "@/lib/subscriptionStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Crown, Sparkles, Shield, PackageOpen } from "lucide-react";
import toast from "react-hot-toast";
import { getServices} from "@/hooks/servicesHooks";
import dynamic from "next/dynamic";
import ListingCardSkeleton from "@/components/ui/ListingCardSkeleton";
import SellerProfileSkeleton from "@/components/ui/SellerProfileSkeleton";
import Header from "@/components/Header";
import CrsaStatsCard from "@/components/CrsaStatsCard";
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
  const [userServices, setUserServices] = useState([]);
  const [activeTab, setActiveTab] = useState("products");

  // Get highest tier subscription badge
  const getSubscriptionBadge = () => {
    if (!subscriptions) return null;

    // Check for VIP (highest tier)
    if (
      (subscriptions.product && isSubscriptionActive(subscriptions.product) && subscriptions.product.planId === "product_vip") ||
      (subscriptions.service && isSubscriptionActive(subscriptions.service) && subscriptions.service.planId === "service_vip")
    ) {
      return {
        label: "VIP",
        icon: Crown,
        className: "bg-gradient-to-r from-yellow-400 to-amber-500 text-white",
      };
    }

    // Check for Premium
    if (
      (subscriptions.product && isSubscriptionActive(subscriptions.product) && subscriptions.product.planId === "product_premium") ||
      (subscriptions.service && isSubscriptionActive(subscriptions.service) && subscriptions.service.planId === "service_premium")
    ) {
      return {
        label: "Premium",
        icon: Sparkles,
        className: "text-white",
        style: { backgroundColor: 'rgb(37,99,235)' }
      };
    }

    // Check for Bundle
    if (subscriptions.bundle && isSubscriptionActive(subscriptions.bundle) && subscriptions.bundle.planId?.includes("bundle")) {
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
        const services = await getServices(currentUser?.uid);
        if (isActive) {
          setUserProducts(products);
          setUserServices(services || []);
        }
      } catch (err) {
        toast.error("Failed to fetch listings");
      }
    };
    if (currentUser) load();
    return () => {
      isActive = false;
    };
  }, [currentUser]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="My Shop" />
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

  const renderGrid = (items, getProduct, editRoute, kind) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="h-full cursor-pointer"
          onClick={() => router.push(`${editRoute}?id=${item.id}`)}
          role="link"
          aria-label={`Edit ${kind}`}
        >
          <ListingCard product={getProduct(item)} btnName="Edit" />
        </div>
      ))}
    </div>
  );

  const renderEmpty = ({ icon: Icon, title, text, cta, route }) => (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      <Button size="lg" className="mt-6" onClick={() => router.push(route)}>
        <Plus /> {cta}
      </Button>
    </div>
  );

  const tabCount = (n) => (
    <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-xs font-bold tabular-nums text-slate-600">{n}</span>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="My Shop" />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <SellerProfileCard userProfile={currentUser} subscriptionBadge={badge} />

        {/* Renders only for active CRSA members — see components/CrsaStatsCard.jsx */}
        <CrsaStatsCard userId={currentUser?.uid} />

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Button size="lg" onClick={() => router.push("/product-upload")} className="sm:min-w-44">
            <Plus /> Add product
          </Button>
          <Button size="lg" variant="soft" onClick={() => router.push("/service-upload")} className="sm:min-w-44">
            <Plus /> Add service
          </Button>
        </div>

        <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-5 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="products" className="sm:min-w-36">
              Products {tabCount(userProducts.length)}
            </TabsTrigger>
            <TabsTrigger value="services" className="sm:min-w-36">
              Services {tabCount(userServices.length)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0">
            {refreshing ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : userProducts.length > 0 ? (
              renderGrid(userProducts, (item) => item.product, "/product-upload", "product")
            ) : (
              renderEmpty({
                icon: PackageOpen,
                title: "No products yet",
                text: "Start selling by adding your first product. It only takes a few minutes!",
                cta: "Add your first product",
                route: "/product-upload",
              })
            )}
          </TabsContent>

          <TabsContent value="services" className="mt-0">
            {refreshing ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : userServices.length > 0 ? (
              renderGrid(userServices, (service) => service, "/service-upload", "service")
            ) : (
              renderEmpty({
                icon: Sparkles,
                title: "No services yet",
                text: "Start offering services by adding your first one. It only takes a few minutes!",
                cta: "Add your first service",
                route: "/service-upload",
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
