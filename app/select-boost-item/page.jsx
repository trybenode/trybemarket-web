"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  Timestamp 
} from "firebase/firestore";
import { Zap, Package, Briefcase, AlertCircle, CheckCircle } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Image from "next/image";
import toast from "react-hot-toast";

export default function SelectBoostItemPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myProducts, setMyProducts] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [activeTab, setActiveTab] = useState("products");
  const [boosting, setBoosting] = useState(false);
  const [hasActiveBoost, setHasActiveBoost] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchMyItems(currentUser.uid);
        checkActiveBoost(currentUser.uid);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const checkActiveBoost = async (userId) => {
    try {
      const now = new Date();
      
      // Check if user has any active boosted items (try both userId and sellerId fields)
      let productsQuery = query(
        collection(db, "products"),
        where("userId", "==", userId),
        where("isBoosted", "==", true),
        where("boostEndDate", ">", now)
      );

      let servicesQuery = query(
        collection(db, "services"),
        where("userId", "==", userId),
        where("isBoosted", "==", true),
        where("boostEndDate", ">", now)
      );

      let [productsSnap, servicesSnap] = await Promise.all([
        getDocs(productsQuery),
        getDocs(servicesQuery)
      ]);

      // If no results with userId, try sellerId
      if (productsSnap.size === 0) {
        productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", userId),
          where("isBoosted", "==", true),
          where("boostEndDate", ">", now)
        );
        productsSnap = await getDocs(productsQuery);
      }

      if (servicesSnap.size === 0) {
        servicesQuery = query(
          collection(db, "services"),
          where("sellerId", "==", userId),
          where("isBoosted", "==", true),
          where("boostEndDate", ">", now)
        );
        servicesSnap = await getDocs(servicesQuery);
      }

      setHasActiveBoost(productsSnap.size > 0 || servicesSnap.size > 0);
    } catch (error) {
      console.error("Error checking active boost:", error);
    }
  };

  const fetchMyItems = async (userId) => {
    try {
      setLoading(true);

      // Try fetching with userId field first (common field name)
      let productsQuery = query(
        collection(db, "products"),
        where("userId", "==", userId)
      );

      let servicesQuery = query(
        collection(db, "services"),
        where("userId", "==", userId)
      );

      let [productsSnap, servicesSnap] = await Promise.all([
        getDocs(productsQuery),
        getDocs(servicesQuery)
      ]);

      // If no results, try with sellerId field
      if (productsSnap.size === 0) {
        productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", userId)
        );
        productsSnap = await getDocs(productsQuery);
      }

      if (servicesSnap.size === 0) {
        servicesQuery = query(
          collection(db, "services"),
          where("sellerId", "==", userId)
        );
        servicesSnap = await getDocs(servicesQuery);
      }

      const products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        boostEndDate: doc.data().boostEndDate?.toDate(),
      }));

      const services = servicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        boostEndDate: doc.data().boostEndDate?.toDate(),
      }));

      console.log("Fetched products:", products.length);
      console.log("Fetched services:", services.length);

      setMyProducts(products);
      setMyServices(services);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Failed to load your items");
    } finally {
      setLoading(false);
    }
  };

  const handleBoostItem = async (itemId, itemType) => {
    if (!user) return;

    try {
      setBoosting(true);
      
      // Calculate boost end date (7 days from now)
      const boostEndDate = new Date();
      boostEndDate.setDate(boostEndDate.getDate() + 7);

      const collectionName = itemType === "product" ? "products" : "services";
      const itemRef = doc(db, collectionName, itemId);

      await updateDoc(itemRef, {
        isBoosted: true,
        boostStartDate: Timestamp.fromDate(new Date()),
        boostEndDate: Timestamp.fromDate(boostEndDate),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      toast.success("Item boosted successfully! 🚀", {
        duration: 4000,
      });

      // Refresh the list
      await fetchMyItems(user.uid);
      await checkActiveBoost(user.uid);
      
      // Redirect to boosted products page after a delay
      setTimeout(() => {
        router.push("/boosted-products");
      }, 2000);
    } catch (error) {
      console.error("Error boosting item:", error);
      toast.error("Failed to boost item. Please try again.");
    } finally {
      setBoosting(false);
    }
  };

  const renderItemCard = (item, type) => {
    const imageUri = Array.isArray(item.images) && item.images.length > 0
      ? item.images[0]?.url || item.images[0]
      : item.image || null;

    const isCurrentlyBoosted = item.isBoosted && item.boostEndDate && new Date(item.boostEndDate) > new Date();

    return (
      <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative h-48 bg-gray-100">
          {imageUri ? (
            <Image
              src={imageUri}
              alt={item.name || "Item"}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-400">No Image</p>
            </div>
          )}

          {isCurrentlyBoosted && (
            <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
              <Zap className="h-3 w-3 mr-1 fill-white" />
              ACTIVE
            </Badge>
          )}
        </div>

        <CardHeader>
          <CardTitle className="text-lg line-clamp-1">{item.name || "Untitled"}</CardTitle>
          <CardDescription className="line-clamp-2">
            {item.description || "No description"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {item.price != null && (
            <p className="text-2xl font-bold text-gray-900">₦{item.price.toLocaleString()}</p>
          )}
          
          {isCurrentlyBoosted && item.boostEndDate && (
            <p className="text-xs text-green-600 mt-2">
              <CheckCircle className="h-3 w-3 inline mr-1" />
              Active until {new Date(item.boostEndDate).toLocaleDateString()}
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Button
            className="w-full text-white"
            style={{ backgroundColor: isCurrentlyBoosted ? '#6B7280' : 'rgb(37,99,235)' }}
            onClick={() => handleBoostItem(item.id, type)}
            disabled={boosting || isCurrentlyBoosted}
            onMouseEnter={(e) => !isCurrentlyBoosted && (e.currentTarget.style.backgroundColor = 'rgb(29,78,216)')}
            onMouseLeave={(e) => !isCurrentlyBoosted && (e.currentTarget.style.backgroundColor = 'rgb(37,99,235)')}
          >
            {isCurrentlyBoosted ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Already Boosted
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Boost This Item
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Header title="Select Item to Boost" />

        {/* Hero Section */}
        <div className="mt-6 mb-8 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-8 w-8 text-yellow-600 fill-yellow-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Boost Your Item
            </h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base mb-4">
            Select a product or service to boost for 7 days. Your item will appear in the "Hot Daily Sales" section with maximum visibility!
          </p>
          
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-gray-700">Homepage spotlight</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-gray-700">Top search priority</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-gray-700">7-day duration</span>
            </div>
          </div>
        </div>

        {hasActiveBoost && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">You have an active boost!</AlertTitle>
            <AlertDescription className="text-green-700">
              You can boost another item once your current boost expires, or choose a different item to boost now.
            </AlertDescription>
          </Alert>
        )}

        {myProducts.length === 0 && myServices.length === 0 && (
          <Alert className="mb-6 border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-900">No items found</AlertTitle>
            <AlertDescription className="text-yellow-700">
              You need to upload at least one product or service before you can boost it.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="products"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md"
            >
              <Package className="h-4 w-4 mr-2" />
              Products ({myProducts.length})
            </TabsTrigger>
            <TabsTrigger 
              value="services"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Services ({myServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            {myProducts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myProducts.map((product) => renderItemCard(product, "product"))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">You haven't uploaded any products yet</p>
                <Button onClick={() => router.push("/product-upload")}>
                  Upload Product
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="services">
            {myServices.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myServices.map((service) => renderItemCard(service, "service"))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <Briefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">You haven't uploaded any services yet</p>
                <Button onClick={() => router.push("/service-upload")}>
                  Upload Service
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
