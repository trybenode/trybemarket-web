"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, MessageCircle, ChevronLeft } from "lucide-react";
import { toast } from 'react-hot-toast';
import { formatNumber } from "@/lib/utils";
import {
  getUserIdOfSeller,
  initiateConversation,
} from "@/utils/messaginghooks";
import SellerDetailsAndRelatedProducts from "@/components/SellerDetailsAndRelatedProducts";

export default function ListingDetailsPage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
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
    const fetchProduct = async () => {
      try {
        if (!id) return;

        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const productData = {
            id: docSnap.id,
            ...docSnap.data(),
          };
          setProduct(productData);
          // console.log("Fetched product:", productData.userId);
          setSellerID(productData.userId);
          if (productData.images?.length > 0) {
            setSelectedImage(
              productData.images[0]?.url || productData.images[0]
            );
          }
        } else {
          console.warn("Product not found");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product) {
      console.log("Seller ID:", product.userId);
    }
  }, [product]);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setCurrentUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  //messaging logic
  // useEffect(() => {
  //   if (currentProduct?.userId) {
  //     setSellerID(currentProduct.userId);
  //   } else if (itemId) {
  //     const fetchSeller = async () => {
  //       try {
  //         const id = await getUserIdOfSeller(itemId);
  //         if (id) setSellerID(id);
  //       } catch (error) {
  //         console.error("Error fetching seller ID:", error);
  //       }
  //     };
  //     fetchSeller();
  //   }
  // }, [currentProduct, itemId]);

  const handleSendMessage = async () => {
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
        navigation.navigate("Chat", {
          conversationId,
          otherUserId: sellerID,
          productDetails,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
        toast.error("Failed to send message", {
          duration: 4000,
          position: "top-right",
        });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLiked = () => setLiked(!liked);

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

  const {
    name = "",
    description = "",
    price = 0,
    originalPrice = 0,
    negotiable = false,
    images = [],
    categoryId = "",
    brand = "",
    condition = "",
    subcategory = "",
    color = "",
    year = "",
  } = product;

  const details = [
    { label: "Category", value: categoryId },
    { label: "Sub Categories", value: subcategory },
    { label: "Brand", value: brand },
    { label: "Condition", value: condition },
    { label: "Color", value: color },
    { label: "Year", value: year },
  ];

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
                alt={name}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No image available</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            {images.map((image, index) => {
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{name}</h1>
            <div className="flex items-center mt-2">
              <p className="text-2xl font-extrabold text-green-600">
                ₦{formatNumber(price)}
              </p>
              {originalPrice > 0 && (
                <p className="ml-2 text-sm text-gray-500 line-through">
                  ₦{formatNumber(originalPrice)}
                </p>
              )}
            </div>
            {negotiable && (
              <span className="inline-block bg-green-600 text-white text-xs px-3 py-1 rounded-full mt-2">
                Negotiable
              </span>
            )}
          </div>

          {/* Tabs for Details & Description */}
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {details.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="font-bold text-gray-800">{item.label}</p>
                      <p className="text-gray-600">{item.value || "N/A"}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="description" className="mt-4">
              <Card className="p-4">
                <p className="text-gray-700 whitespace-pre-line">
                  {description || "No description available"}
                </p>
              </Card>
            </TabsContent>
          </Tabs>

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
      <SellerDetailsAndRelatedProducts
        key={effectiveProductId}
        productId={effectiveProductId}
        product={currentProduct}
      />
    </div>
  );
}
