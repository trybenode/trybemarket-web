"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { toast } from "react-hot-toast";
import BackBtn from "@/components/BackButton";
import { formatNumber } from "@/lib/utils";
import { getServiceById } from "@/utils/servicesHooks";
import useUserStore from "@/lib/userStore";
import { initiateConversation } from "@/utils/messaginghooks";
import useFavoritesStore from "@/lib/FavouriteStore";
import ProductDetailsHeader from "@/components/ProductDetailsHeader";

export default function ServicePage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [liked, setLiked] = useState(false);
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useUserStore((state) => state.user);
  const getUserFullName = useUserStore((state) => state.getUserFullName);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);

  // Fetch service by id
  useEffect(() => {
    const fetchService = async () => {
      if (!id) return;
      try {
        const serviceData = await getServiceById(id);
        if (serviceData) {
          setService(serviceData);
        } else {
          toast.error("Service not found");
        }
      } catch (error) {
        toast.error("Error fetching service");
      } finally {
        setLoading(false);
      }
    };
    fetchService();
    // eslint-disable-next-line
  }, [params]);

  useEffect(() => {
    if (service && service.id) {
      setLiked(favoriteIds.includes(service.id));
    }
  }, [service, favoriteIds]);

  // Function to format availability display
  const formatAvailability = (availability) => {
    if (availability && typeof availability === "object" && availability.type) {
      if (availability.type === "on_contact") {
        return "Available on Contact";
      } else if (
        availability.type === "timeframe" &&
        availability.start &&
        availability.end
      ) {
        const start = new Date(availability.start).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const end = new Date(availability.end).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        });
        return `From ${start} to ${end}`;
      }
    }
    return "Not Available";
  };

  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? service.images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === service.images.length - 1 ? 0 : prev + 1
    );
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message", {
        duration: 4000,
        position: "top-right",
      });
      return;
    }
    if (!currentUser) {
      toast.error("Please login to send a message", {
        duration: 4000,
        position: "top-right",
      });
      router.push("/login");
      return;
    }
    setSendingMessage(true);
    try {
      // Prepare productDetails for the conversation
      const productDetails = {
        name: service.name,
        imageUrl: service.images?.[0] || "",
        id: service.id,
        sellerID: service.userId,
      };
      console.log("Product Details:", productDetails);
      const instigatorName =
        getUserFullName() || currentUser?.fullName || "Anonymous User";
      const instigatorInfo = {
        id: currentUser.id,
        name: instigatorName,
      };
      console.log("Instigator Info:", instigatorInfo);
      const conversationId = await initiateConversation(
        message,
        currentUser.id,
        service.userId,
        productDetails,
        instigatorInfo,
        "service_provider"
      );
      setMessage("");
      toast.success("Message sent successfully", {
        duration: 2000,
        position: "top-right",
      });
      // Fire and forget the email notification (API call)
      fetch("/api/send-message-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: service.email, // You may need to fetch provider email if not present
          senderName: instigatorName,
          productName: service.name,
          chatLink: `https://trybemarket.vercel.app/chat/${conversationId}`,
        }),
      }).catch((error) => {
        console.error("Error sending email notification:", error);
      });
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      toast.error("Failed to send message", {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLiked = () => {
    if (!currentUser) {
      toast.error("Please login to add items to favorites", {
        duration: 4000,
        position: "top-right",
      });
      router.push("/login");
      return;
    }
    console.log(service.id, "service ID in handleLiked");
    toggleFavorite(service.id);
    setLiked(!liked);
    toast.success(liked ? "Removed from favorites" : "Added to favorites", {
      duration: 2000,
      position: "top-right",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-xl text-gray-600 mb-4">Service not found</p>
        <Button onClick={() => router.push("/")}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4  py-4 max-w-6xl">
      <ProductDetailsHeader id={id} currentUserId={currentUser} />

      {/* Header */}

      {/* {/* Two Equal Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Images */}
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
            {service.images[currentImageIndex] ? (
              <div key={currentImageIndex}>
                <Image
                  src={service.images[currentImageIndex]}
                  alt={`${service.name} image ${currentImageIndex + 1}`}
                  width={600}
                  height={600}
                  priority={currentImageIndex === 0}
                  className="object-contain w-full h-full"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No image available</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={handlePrevImage}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              onClick={handleNextImage}
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {service.images.map((image, index) => (
              <div
                key={index}
                className={`relative w-20 h-20 rounded-md overflow-hidden cursor-pointer border-2 ${
                  currentImageIndex === index
                    ? "border-blue-500"
                    : "border-transparent"
                }`}
                onClick={() => setCurrentImageIndex(index)}
              >
                <Image
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Details & Actions */}
        <div className="space-y-6">
          {/* Price Card */}
          <Card className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {service.name}
            </h2>
            <span className="inline-block text-gray-500 text-base py-1 rounded-full mt-2">
              Base Price
            </span>
            <p className="text-2xl font-extrabold text-green-600">
              ₦{formatNumber(service.price)}
            </p>
          </Card>

          {/* Tabs for Details & Description */}
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-lg p-1">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-4">
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="font-bold text-gray-800">Name</p>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                          AD
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-gray-600">{service.name}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-gray-800">Category</p>
                    <p className="text-gray-600">{service.categoryId}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-gray-800">University</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-600">{service.university}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-gray-800">Availability</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <p className="text-gray-600">
                        {formatAvailability(service.availability)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value="description" className="mt-4">
              <Card className="p-4">
                <p className="text-gray-700 whitespace-pre-line">
                  {service.description}
                </p>
              </Card>
            </TabsContent>
            <TabsContent value="reviews" className="mt-4">
              <Card className="p-4">
                <p className="text-gray-700 italic">
                  No reviews yet. Be the first to leave a review!
                </p>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Message Box */}
          <Card className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Make an Offer:</h2>
            <div className="flex">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 rounded-l-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                onClick={handleSendMessage}
                className="rounded-l-none bg-blue-600 hover:bg-blue-700"
                disabled={sendingMessage}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
