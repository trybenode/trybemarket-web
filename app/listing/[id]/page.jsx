"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useInView } from "react-intersection-observer";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

import { Separator } from "@/components/ui/separator";
import { Heart, MessageCircle, ChevronLeft, Loader } from "lucide-react";
import { toast } from "react-hot-toast";
import { formatNumber } from "@/lib/utils";
import useFavoritesStore from "@/lib/FavouriteStore";
const LazyComponent = dynamic(
  () => import("@/components/SellerDetailsAndRelatedProducts"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);

import { initiateConversation } from "@/utils/messaginghooks";

export default function ListingDetailsPage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  // const { id } = params;
  const { ref, inView } = useInView({ triggerOnce: true });
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const itemId = id || product?.id;
  const [sellerID, setSellerID] = useState(null);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [liked, setLiked] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const effectiveProductId = itemId || currentProduct?.id;

  //product fetch
  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      try {
        setLoading(true);
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const productData = { id: docSnap.id, ...docSnap.data() };
          setProduct(productData);

          if (productData.images?.length) {
            setSelectedImage(
              productData.images[0]?.url || productData.images[0]
            );
          }
        } else {
          toast.error("Product not found");
          setProduct(null);
        }
      } catch (err) {
        // console.error(err);
        toast.error("Failed to fetch product data");
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  // useEffect(() => {
  //   if (product) {
  //     console.log("Seller ID:", product.userId);
  //   }
  // }, [product]);
  useEffect(() => {
    if (id) {
      setLiked(favoriteIds.includes(id));
    }
  }, [id, favoriteIds]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setCurrentUserId(user.uid);
      // setCurrentUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  // const {
  //   name = "",
  //   description = "",
  //   price = 0,
  //   originalPrice = 0,
  //   negotiable = false,
  //   images = [],
  //   categoryId = "",
  //   brand = "",
  //   condition = "",
  //   subcategory = [],
  //   color = "",
  //   year = "",
  // } = product;

  const details = useMemo(() => {
    if (!product) return [];
    return [
      { label: "Category", value: product.categoryId || "N/A" },
      { label: "Sub Categories", value: product.subcategory || [] },
      { label: "Brand", value: product.brand || "N/A" },
      { label: "Condition", value: product.condition || "N/A" },
      { label: "Color", value: product.color || "N/A" },
      { label: "Year", value: product.year || "N/A" },
    ];
  }, [product]);

  const handleLiked = useCallback(() => {
    if (!currentUserId) {
      toast.error("Please login to add items to favorites", {
        duration: 4000,
        position: "top-right",
      });
      router.push("/login");
      return;
    }

    toggleFavorite(id);
    setLiked(!liked);
    toast.success(liked ? "Removed from favorites" : "Added to favorites", {
      duration: 2000,
      position: "top-right",
    });
  }, [currentUserId, id, liked, router, toggleFavorite]);

  const handleSendMessage = useCallback(async () => {
    try {
      if (!message.trim() || !currentUserId || !sellerID) {
        toast.error("Message and user information required", {
          duration: 4000,
          position: "top-right",
        });
        return;
      }

      setSendingMessage(true);

      const productDetails = {
        name,
        imageUrl: images[0]?.url || images[0] || "",
        id: effectiveProductId,
      };

      const conversationId = await initiateConversation(
        message,
        currentUserId,
        sellerID,
        productDetails
      );

      setMessage("");

      if (conversationId) {
        router.push(`/chat/${conversationId}`);
      }
    } catch (error) {
      // console.error("Error sending message:", error);
      toast.error("Failed to send message", {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setSendingMessage(false);
    }
  }, [message, currentUserId, product, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-xl text-gray-600 mb-4">Product not found</p>
        <Button onClick={() => router.push("/")}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center">
        <Button
          variant="ghost"
          className="p-0 mr-2"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Product Details</h1>
        <Button variant="ghost" className="ml-auto" onClick={handleLiked}>
          <Heart
            className={`h-6 w-6 ${liked ? "fill-red-500 text-red-500" : ""}`}
          />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images */}
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
            {selectedImage ? (
              <Image
                src={selectedImage}
                alt={product.name}
                // fill
                width={600}
                height={600}
                // priority
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No image available</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            {product.images?.map((image, index) => {
              const imgSrc = image.url || image;
              return (
                <div
                  key={index}
                  className={`relative w-20 h-20 rounded-md overflow-hidden cursor-pointer border-2 ${
                    selectedImage === imgSrc
                      ? "border-blue-500"
                      : "border-transparent"
                  }`}
                  onClick={() => setSelectedImage(imgSrc)}
                >
                  <Image
                    src={imgSrc}
                    alt={`Product image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="80px"
                    loading="lazy"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Details & Actions */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center mt-2">
              <p className="text-2xl font-extrabold text-green-600">
                ₦{formatNumber(product.price)}
              </p>
              {product.originalPrice > 0 && (
                <p className="ml-2 text-sm text-gray-500 line-through">
                  ₦{formatNumber(product.originalPrice)}
                </p>
              )}
            </div>
            {product.negotiable && (
              <span className="inline-block bg-green-600 text-white text-xs px-3 py-1 rounded-full mt-2">
                Negotiable
              </span>
            )}
          </div>

          {/* Tabs for Details & Description */}
          <div>
            <div className="text-center font-semibold text-gray-800 border-b-2 border-black pb-1">
              Details
            </div>

            {/* Details Section */}
            <div className="p-4 rounded-xl border bg-white shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                {details.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-bold text-gray-800">{item.label}</p>
                    <p className="text-gray-600">
                      {Array.isArray(item.value)
                        ? item.value.join(", ") || "N/A"
                        : item.value || "N/A"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description Section */}
            <div className="p-4 mt-4 rounded-xl border bg-white shadow-sm">
              <p className="text-gray-700 whitespace-pre-line">
                {product.description || "No description available"}
              </p>
            </div>
          </div>

          {/* Offer Box */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Make an Offer:</h2>
            <div className="flex">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 rounded-l-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button onClick={handleSendMessage} className="rounded-l-none">
                <MessageCircle className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Seller Info */}
      {/* <SellerDetailsAndRelatedProducts
        key={effectiveProductId}
        productId={effectiveProductId}
        product={currentProduct}
      /> */}
      <div ref={ref}>
        {inView && (
          <LazyComponent
            key={effectiveProductId}
            productId={effectiveProductId}
            product={currentProduct}
          />
        )}
      </div>
    </div>
  );
}

// priority={index === 0}