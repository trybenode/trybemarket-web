"use client";
import React, { useState, useEffect } from "react";
import { useRouter, notFound } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Calendar,
  X,
} from "lucide-react";
import UpgradePrompt from "@/components/UpgradePrompt";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { getServiceById } from "@/hooks/servicesHooks";
import useUserStore from "@/lib/userStore";
import { initiateConversation, getUserInfo } from "@/utils/messaginghooks";
import { isUserRecentlyActive } from "@/hooks/useLastSeen";
import useFavoritesStore from "@/lib/FavouriteStore";
import ProductDetailsHeader from "@/components/ProductDetailsHeader";
import { sendMessageNotification } from "@/lib/notificationClient";
import ImageGallery from "@/components/listing/ImageGallery";
import SellerCard from "@/components/listing/SellerCard";
import ContactComposer from "@/components/listing/ContactComposer";
import ListingSkeleton from "@/components/listing/ListingSkeleton";
import SafetyNote from "@/components/listing/SafetyNote";

// One-tap first messages for a service (the product page has its own set).
const SERVICE_QUICK_REPLIES = [
  "Are you available this week?",
  "What's your rate for this?",
  "Can you do it on campus?",
];

const SERVICE_SAFETY_TIPS = [
  "Agree the price and what's included before you start.",
  "Meet in a busy, public spot on campus.",
  "Keep chatting inside TrybeMarket.",
];

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
  const [descOpen, setDescOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
          sendMessageNotification({ conversationId, channels, productName: service.name })
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
      <div className="min-h-screen bg-slate-50">
        <ProductDetailsHeader id={id} currentUserId={currentUser} title="Service" />
        <ListingSkeleton />
      </div>
    );
  }

  if (!service) {
    notFound();
  }

  const images = (service.images || []).filter(Boolean);
  const availability = formatAvailability(service.availability);
  const description = service.description || "";
  const detailRows = [
    ["Category", service.categoryId],
    ["University", service.university],
    ["Availability", availability],
  ].filter(([, value]) => value);

  const isOwner = !!currentUser?.id && currentUser.id === service.userId;
  const sellerFirstName = (sellerInfo?.fullName || "the provider").split(" ")[0];

  const openMessage = () => {
    if (!currentUser) {
      toast("Please log in to message the provider", { duration: 3000 });
      router.push("/login");
      return;
    }
    setSheetOpen(true);
  };

  const composer = (
    <ContactComposer
      message={message}
      setMessage={setMessage}
      onSend={handleSendMessage}
      sending={sendingMessage}
      quickReplies={SERVICE_QUICK_REPLIES}
      placeholder="Write a message to the provider…"
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-12">
      <ProductDetailsHeader id={id} currentUserId={currentUser} category={service?.categoryId} title="Service" />

      <main className="mx-auto max-w-6xl md:grid md:grid-cols-[1.1fr_1fr] md:items-start md:gap-8 md:px-4 md:py-6">
        <div className="md:sticky md:top-20">
          <ImageGallery
            images={images}
            name={service.name}
            activeIndex={Math.min(currentImageIndex, Math.max(images.length - 1, 0))}
            onChange={setCurrentImageIndex}
            onOpen={handleImageClick}
          />
        </div>

        <div className="space-y-4 px-4 pt-5 md:px-0 md:pt-0">
          {/* Title & price */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold leading-snug text-slate-900 md:text-2xl">{service.name}</h1>
            <p className="mt-2 text-xs font-medium text-slate-500">Starting price</p>
            {service.price != null ? (
              <PriceTag price={service.price} size="lg" />
            ) : (
              <p className="text-lg font-bold text-slate-700">Ask for price</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {service.categoryId && <Badge variant="brand">{service.categoryId}</Badge>}
              <Badge variant="muted">
                <Calendar className="h-3 w-3" /> {availability}
              </Badge>
            </div>
          </section>

          <SellerCard seller={sellerInfo} sellerId={service.userId} />

          {/* Description */}
          {description && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">About this service</h2>
              <p
                className={cn(
                  "whitespace-pre-line text-sm leading-relaxed text-slate-600",
                  !descOpen && "line-clamp-4"
                )}
              >
                {description}
              </p>
              {description.length > 200 && (
                <button
                  type="button"
                  onClick={() => setDescOpen((open) => !open)}
                  className="mt-2 text-sm font-semibold text-primary hover:underline"
                >
                  {descOpen ? "Show less" : "Read more"}
                </button>
              )}
            </section>
          )}

          {/* Details */}
          {detailRows.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {detailRows.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm font-medium text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Contact (desktop; phones use the bottom bar + sheet) */}
          <section className="hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:block">
            {isOwner ? (
              <p className="text-sm text-slate-600">This is your service. Students will message you from here.</p>
            ) : (
              <>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-primary" /> Message {sellerFirstName}
                </h2>
                {composer}
              </>
            )}
          </section>

          <SafetyNote tips={SERVICE_SAFETY_TIPS} />
        </div>
      </main>

      {/* Phone: sticky action bar */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              {service.price != null ? (
                <PriceTag price={service.price} size="md" />
              ) : (
                <p className="text-sm font-semibold text-slate-600">Ask for price</p>
              )}
            </div>
            <Button size="lg" onClick={openMessage} className="shrink-0">
              <MessageCircle />
              Message provider
            </Button>
          </div>
        </div>
      )}

      {/* Phone: message sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Message {sellerFirstName}</SheetTitle>
            <SheetDescription>Ask about “{service.name}”. Tap a quick question or write your own.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{composer}</div>
        </SheetContent>
      </Sheet>

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
