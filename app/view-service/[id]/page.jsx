"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import UpgradePrompt from "@/components/UpgradePrompt";
import { toast } from "react-hot-toast";
import BackBtn from "@/components/BackButton";
import { formatNumber } from "@/lib/utils";
import { getServiceById } from "@/hooks/servicesHooks";
import useUserStore from "@/lib/userStore";
import { initiateConversation, getUserInfo } from "@/utils/messaginghooks";
import { isUserRecentlyActive } from "@/hooks/useLastSeen";
import useFavoritesStore from "@/lib/FavouriteStore";
import ProductDetailsHeader from "@/components/ProductDetailsHeader";

export default function ServicePage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [liked, setLiked] = useState(false);
  const [service, setService] = useState(null);
  const [sellerInfo, setSellerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
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

  // Fetch seller info when service is loaded
  useEffect(() => {
    const fetchSellerInfo = async () => {
      if (!service || !service.userId) return;

      try {
        const userInfo = await getUserInfo(service.userId);
        if (userInfo) {
          setSellerInfo(userInfo);
          console.log("Seller info fetched:", userInfo);
        } else {
          console.warn("Seller not found");
        }
      } catch (error) {
        console.error("Error fetching seller info:", error);
      }
    };

    fetchSellerInfo();
  }, [service]);

  // Function to format availability display
  const formatAvailability = (availability) => {
    if (availability && typeof availability === "object" && availability.type) {
      if (availability.type === "on_contact") {
        return "Available on Contact";
      } else if (
        availability.type === "specific_time" &&
        availability.start &&
        availability.end
      ) {
        const formatTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(":").map(Number);
          const date = new Date();
          date.setHours(hours, minutes);
          return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        };

        const startFormatted = formatTime(availability.start);
        const endFormatted = formatTime(availability.end);

        return `From ${startFormatted} to ${endFormatted}`;
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

  const handleImageClick = () => {
    setIsImageModalOpen(true);
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
      
      // Check if seller is recently active (within last 5 minutes)
      const isSellerActive = sellerInfo?.lastSeen 
        ? isUserRecentlyActive(sellerInfo.lastSeen)
        : false;
      
      console.log("Seller active?", isSellerActive);
      
      // Only send notification if seller is offline
      if (!isSellerActive) {
        // Send notification via unified API (checks sender's daily limit)
        const channels = [];
        if (sellerInfo?.whatsappNotifications && sellerInfo?.phone) {
          channels.push("whatsapp");
        }
        if (sellerInfo?.emailNotifications !== false && sellerInfo?.email) {
          channels.push("email");
        }

        if (channels.length > 0) {
          fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id, // Sender's ID - for email quota check
            recipientId: service.userId, // Recipient's ID - for WhatsApp quota check
            recipientPhone: sellerInfo.phone,
            recipientEmail: sellerInfo.email,
            recipientName: sellerInfo.fullName || "User",
            senderName: instigatorName,
            productName: service.name,
            chatLink: `https://trybemarket.online/chat/${conversationId}`,
            conversationId,
            channels,
          }),
        })
          .then(async (response) => {
            const data = await response.json();
            
            if (response.status === 429 && data.reason === "email_limit_reached") {
              setShowUpgradePrompt(true);
              return;
            }
            
            if (data.success) {
              console.log("Notification sent. Email remaining:", data.emailSent?.remaining);
              console.log("WhatsApp blocked?", data.results?.whatsappBlocked);
            }
          })
          .catch((error) => {
            console.error("Error sending notification:", error);
          });
        }
      } else {
        console.log("Seller is online - skipping notification");
      }

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
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    );
  }

  if (!service) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen'>
        <p className='text-xl text-gray-600 mb-4'>Service not found</p>
        <Button onClick={() => router.push("/")}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-6 max-w-6xl'>
      <ProductDetailsHeader id={id} currentUserId={currentUser} category={service?.categoryId} />

      {/* Header */}

      {/* {/* Two Equal Columns */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
        {/* Left Column - Images */}
        <div className='space-y-4'>
          <div 
            className='relative rounded-lg overflow-hidden bg-gray-100 aspect-square cursor-pointer hover:opacity-95 transition-opacity'
            onClick={handleImageClick}
          >
            {service.images[currentImageIndex] ? (
              <div key={currentImageIndex}>
                <Image
                  src={service.images[currentImageIndex]}
                  alt={`${service.name} image ${currentImageIndex + 1}`}
                  width={600}
                  height={600}
                  priority={currentImageIndex === 0}
                  className='object-contain w-full h-full'
                  sizes='(max-width: 768px) 100vw, 50vw'
                />
              </div>
            ) : (
              <div className='flex items-center justify-center h-full'>
                <p className='text-gray-500'>No image available</p>
              </div>
            )}
            <Button
              variant='ghost'
              size='icon'
              className='absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full'
              onClick={(e) => {
                e.stopPropagation();
                handlePrevImage();
              }}
              aria-label='Previous image'
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/50 hover:bg-black/70 text-white rounded-full'
              onClick={(e) => {
                e.stopPropagation();
                handleNextImage();
              }}
              aria-label='Next image'
            >
              <ChevronRight className='h-5 w-5' />
            </Button>
          </div>
          <div className='flex space-x-2 overflow-x-auto pb-2'>
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
                  className='object-cover'
                  sizes='80px'
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Details & Actions */}
        <div className='space-y-6'>
          {/* Price Card */}
          <Card className='bg-gray-50 p-6 rounded-lg border border-gray-200'>
            <h2 className='text-2xl font-bold text-gray-900 mb-2'>
              {service.name}
            </h2>
            <span className='inline-block text-gray-500 text-base py-1 rounded-full mt-2'>
              Base Price
            </span>
            <p className='text-2xl font-extrabold text-green-600'>
              ₦{formatNumber(service.price)}
            </p>
          </Card>

          {/* Tabs for Details & Description */}
          <Tabs defaultValue='details'>
            <TabsList className='grid w-full grid-cols-3 bg-gray-100 rounded-lg p-1'>
              <TabsTrigger value='details'>Details</TabsTrigger>
              <TabsTrigger value='description'>Description</TabsTrigger>
              <TabsTrigger value='reviews'>Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value='details' className='mt-4'>
              <Card className='p-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-1'>
                    <p className='font-bold text-gray-800'>Name</p>
                    <div className='flex items-center gap-2'>
                      {/* <Avatar className='h-8 w-8'>
                        <AvatarFallback className='bg-gray-200 text-gray-600 text-sm'>
                          AD
                        </AvatarFallback>
                      </Avatar> */}
                      <p className='text-gray-600'>{service.name}</p>
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <p className='font-bold text-gray-800'>Category</p>
                    <p className='text-gray-600'>{service.categoryId}</p>
                  </div>
                  <div className='space-y-1'>
                    <p className='font-bold text-gray-800'>University</p>
                    <div className='flex items-center gap-2'>
                      <MapPin className='h-4 w-4 text-gray-500' />
                      <p className='text-gray-600'>{service.university}</p>
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <p className='font-bold text-gray-800'>Availability</p>
                    <div className='flex items-center gap-2'>
                      <Calendar className='h-4 w-4 text-gray-500' />
                      <p className='text-gray-600'>
                        {formatAvailability(service.availability)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>
            <TabsContent value='description' className='mt-4'>
              <Card className='p-4'>
                <p className='text-gray-700 whitespace-pre-line'>
                  {service.description}
                </p>
              </Card>
            </TabsContent>
            <TabsContent value='reviews' className='mt-4'>
              <Card className='p-4'>
                <p className='text-gray-700 italic'>
                  No reviews yet. Be the first to leave a review!
                </p>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Message Box */}
          <Card className='bg-gray-50 p-4 rounded-lg border border-gray-200'>
            <h2 className='text-lg font-semibold mb-2'>Contact Provider:</h2>
            <div className='flex'>
              <input
                type='text'
                placeholder='Type your message...'
                className='flex-1 rounded-l-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                onClick={handleSendMessage}
                className='rounded-l-none bg-blue-600 hover:bg-blue-700'
                disabled={sendingMessage}
              >
                <MessageCircle className='h-4 w-4 mr-2' />
                Send
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className='max-w-4xl w-[90vw] md:w-[85vw] p-0 bg-white border-gray-200'>
          <DialogTitle className='sr-only'>Image viewer</DialogTitle>
          <DialogClose className='absolute right-3 top-3 z-50 rounded-full bg-black/60 hover:bg-black/80 p-2.5 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white'>
            <X className='h-5 w-5 text-white' />
            <span className='sr-only'>Close</span>
          </DialogClose>
          <div className='relative w-full'>

            {/* Image Container */}
            <div className='relative w-full bg-gray-50 rounded-lg overflow-hidden'>
              <div className='relative w-full' style={{ minHeight: '300px', maxHeight: '80vh' }}>
                {service?.images[currentImageIndex] ? (
                  <div className='relative w-full h-full flex items-center justify-center p-4 md:p-8'>
                    <Image
                      src={service.images[currentImageIndex]}
                      alt={`${service.name} image ${currentImageIndex + 1}`}
                      width={1200}
                      height={800}
                      className='object-contain w-full h-auto max-h-[70vh] rounded-md'
                      sizes='(max-width: 768px) 90vw, 85vw'
                      priority
                    />
                  </div>
                ) : (
                  <div className='flex items-center justify-center h-64'>
                    <p className='text-gray-500 text-lg'>No image available</p>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              {service?.images && service.images.length > 1 && (
                <>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-md'
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    aria-label='Previous image'
                  >
                    <ChevronLeft className='h-5 w-5 md:h-6 md:w-6' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 bg-white/90 hover:bg-white text-gray-700 rounded-full shadow-md'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    aria-label='Next image'
                  >
                    <ChevronRight className='h-5 w-5 md:h-6 md:w-6' />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation & Counter */}
            {service?.images && service.images.length > 1 && (
              <div className='p-4 bg-white border-t'>
                <div className='flex items-center justify-center gap-2 mb-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    {currentImageIndex + 1} / {service.images.length}
                  </span>
                </div>
                <div className='flex justify-center gap-2 overflow-x-auto pb-2'>
                  {service.images.map((image, index) => (
                    <div
                      key={index}
                      className={`relative w-14 h-14 md:w-16 md:h-16 rounded-md overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${
                        currentImageIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      onClick={() => setCurrentImageIndex(index)}
                    >
                      <Image
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className='object-cover'
                        sizes='64px'
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
