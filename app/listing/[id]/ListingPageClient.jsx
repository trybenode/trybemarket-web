"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useInView } from "react-intersection-observer";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PriceTag, discountPercent } from "@/components/ui/price-tag";
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
import { MessageCircle, ChevronLeft, ChevronRight, X, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";
import { formatNumber } from "@/lib/utils";
import { getUserInfo } from "@/utils/userInfo";
import useFavoritesStore from "@/lib/FavouriteStore";
import useUserStore from "@/lib/userStore";
const LazyComponent = dynamic(
  () => import("@/components/SellerDetailsAndRelatedProducts"),
  {
    loading: () => null,
    ssr: false,
  }
);

import {
  getUserIdOfSeller,
  initiateConversation,
} from "@/utils/messaginghooks";
import { isUserRecentlyActive } from "@/hooks/useLastSeen";

import ProductDetailsHeader from "@/components/ProductDetailsHeader";
import ImageGallery from "@/components/listing/ImageGallery";
import SellerCard from "@/components/listing/SellerCard";
import ContactComposer from "@/components/listing/ContactComposer";
import ListingSkeleton from "@/components/listing/ListingSkeleton";
import { cn } from "@/lib/utils";
import { sendMessageNotification } from "@/lib/notificationClient";

export default function ListingDetailsPage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const { ref, inView } = useInView({ triggerOnce: true });
  const currentUser = useUserStore((state) => state.user);
  const getUserFullName = useUserStore((state) => state.getUserFullName);
  const itemId = id || product?.id;
  const [sellerID, setSellerID] = useState(null);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [liked, setLiked] = useState(false);
  const [message, setMessage] = useState("");
  const [AllUserInfo, setAllUserInfo] = useState({});
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
          
          // Track listing viewed event
          import('@/utils/analytics').then(({ trackEvent, EVENT_TYPES }) => {
            import('@/utils/session').then(({ getOrCreateSessionId }) => {
              import('@/lib/userStore').then((module) => {
                const useUserStore = module.default;
                trackEvent(EVENT_TYPES.LISTING_VIEWED, productData.id, 'listing', {
                  campus_id: productData.university || useUserStore.getState().selectedUniversity,
                  seller_id: productData.userId,
                  category: productData.categoryId,
                  listing_type: 'product',
                  price: productData.price,
                  session_id: getOrCreateSessionId(),
                });
              });
            });
          });
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
    const fetchSellerInfo = async () => {
      if (!sellerID) return;

      try {
        const userInfo = await getUserInfo(sellerID);
        if (userInfo) {
          setAllUserInfo(userInfo);
          // console.log(userInfo.email)
        } else {
          console.warn("Seller not found");
        }
      } catch (error) {
        console.error("Error fetching seller info:", error);
      }
    };

    fetchSellerInfo();
  }, [sellerID]);

  useEffect(() => {
    if (product) {
      // console.log("Seller ID:", product.userId);
    }
  }, [product]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setCurrentUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const handleImageClick = () => {
    setIsImageModalOpen(true);
  };

  const handlePrevImage = () => {
    const currentIndex = images.findIndex((img) => {
      const imgSrc = img.url || img;
      return imgSrc === selectedImage;
    });
    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    const prevImgSrc = images[prevIndex]?.url || images[prevIndex];
    setSelectedImage(prevImgSrc);
  };

  const handleNextImage = () => {
    const currentIndex = images.findIndex((img) => {
      const imgSrc = img.url || img;
      return imgSrc === selectedImage;
    });
    const nextIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    const nextImgSrc = images[nextIndex]?.url || images[nextIndex];
    setSelectedImage(nextImgSrc);
  };

  const handleSendMessage = async () => {
    try {
      if (!currentUserId) {
        toast("Please log in to message the seller", { duration: 3000 });
        router.push("/login");
        return;
      }

      if (!message.trim() || !sellerID) {
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
        sellerID,
      };

      // Get user's full name from the store
      const instigatorName =
        getUserFullName() || currentUser?.fullName || "Anonymous User";
      const instigatorInfo = {
        id: currentUserId,
        name: instigatorName,
      };
      const conversationId = await initiateConversation(
        message,
        currentUserId,
        sellerID,
        productDetails,
        instigatorInfo,
        "product"
      );

      setMessage("");

      if (conversationId) {
        // Track conversation started — always a new conversation from here
        import('@/utils/analytics').then(({ trackEvent, EVENT_TYPES }) => {
          import('@/utils/session').then(({ getOrCreateSessionId }) => {
            import('@/lib/userStore').then((module) => {
              const useUserStore = module.default;
              trackEvent(EVENT_TYPES.CONVERSATION_STARTED, conversationId, 'conversation', {
                listing_id: effectiveProductId,
                seller_id: sellerID,
                campus_id: useUserStore.getState().selectedUniversity,
                session_id: getOrCreateSessionId(),
              });
            });
          });
        });

        // Check if seller is recently active (within last 5 minutes)
        const isSellerActive = AllUserInfo.lastSeen 
          ? isUserRecentlyActive(AllUserInfo.lastSeen)
          : false;
        
        console.log("Seller active?", isSellerActive);
        
        // Only send notification if seller is offline
        if (!isSellerActive) {
          // Send notification via unified API (checks sender's daily limit)
          const channels = [];
          if (AllUserInfo.whatsappNotifications && AllUserInfo.phone) {
            channels.push("whatsapp");
          }
          if (AllUserInfo.emailNotifications !== false && AllUserInfo.email) {
            channels.push("email");
          }

          if (channels.length > 0) {
            sendMessageNotification({ conversationId, channels, productName: productDetails.name })
            .then(async (response) => {
              const data = await response.json();
              
              if (response.status === 429 && data.reason === "email_limit_reached") {
                setShowUpgradePrompt(true);
                return;
              }
              
              if (data.success) {
                console.log("Notification sent. Email remaining:", data.emailSent?.remaining);
                console.log("WhatsApp blocked?", data.results?.whatsappBlocked);
                // lastNotifiedAt is now updated server-side in the API route
              }
            })
            .catch((error) => {
              console.error("Error sending notification:", error);
            });
          }
        } else {
          console.log("Seller is online - skipping notification");
        }
        
        // Navigate user immediately
        router.push(`/chat/${conversationId}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ProductDetailsHeader id={id} currentUserId={currentUserId} title="Listing" />
        <ListingSkeleton />
      </div>
    );
  }

  if (!product) {
    notFound();
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
    subcategory = [],
    color = "",
    year = "",
  } = product;

  const urls = images.map((img) => img?.url || img).filter(Boolean);
  const activeIndex = Math.max(0, urls.indexOf(selectedImage));
  const off = discountPercent(price, originalPrice);
  const subs = Array.isArray(subcategory) ? subcategory : subcategory ? [subcategory] : [];
  const detailRows = [
    ["Category", categoryId],
    ["Subcategory", subs.join(", ")],
    ["Brand", brand],
    ["Condition", condition],
    ["Color", color],
    ["Year", year],
  ].filter(([, value]) => value);

  const sellerLoaded = Object.keys(AllUserInfo).length > 0 ? AllUserInfo : null;
  const isOwner = !!currentUserId && !!sellerID && currentUserId === sellerID;
  const sellerFirstName = (AllUserInfo.fullName || "the seller").split(" ")[0];

  const openMessage = () => {
    if (!currentUserId) {
      toast("Please log in to message the seller", { duration: 3000 });
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
      negotiable={negotiable}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-12">
      <ProductDetailsHeader id={id} currentUserId={currentUserId} category={categoryId} title="Listing" />

      <main className="mx-auto max-w-6xl md:grid md:grid-cols-[1.1fr_1fr] md:items-start md:gap-8 md:px-4 md:py-6">
        <div className="md:sticky md:top-20">
          <ImageGallery
            images={images}
            name={name}
            activeIndex={activeIndex}
            onChange={(index) => setSelectedImage(urls[index])}
            onOpen={handleImageClick}
          />
        </div>

        <div className="space-y-4 px-4 pt-5 md:px-0 md:pt-0">
          {/* Title & price */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold leading-snug text-slate-900 md:text-2xl">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <PriceTag price={price} originalPrice={originalPrice} size="lg" />
              {off !== null && <Badge variant="success">Save {off}%</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {negotiable && <Badge variant="brand">Negotiable</Badge>}
              {condition && (
                <Badge variant="muted" className="capitalize">
                  {condition}
                </Badge>
              )}
              {brand && <Badge variant="muted">{brand}</Badge>}
            </div>
          </section>

          <SellerCard seller={sellerLoaded} sellerId={sellerID} />

          {/* Description */}
          {description && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">About this item</h2>
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
                    <dd className="truncate text-sm font-medium capitalize text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Contact (desktop; phones use the bottom bar + sheet) */}
          <section className="hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:block">
            {isOwner ? (
              <p className="text-sm text-slate-600">This is your listing. Buyers will message you from here.</p>
            ) : (
              <>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <MessageCircle className="h-4 w-4 text-primary" /> Message {sellerFirstName}
                </h2>
                {composer}
              </>
            )}
          </section>

          {/* Safety */}
          <section className="rounded-2xl border border-brand-yellow/60 bg-brand-yellow-soft p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-amber-600" /> Stay safe on campus
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
              <li>Meet in a busy, public spot on campus.</li>
              <li>Check the item before you pay.</li>
              <li>Keep chatting inside TrybeMarket.</li>
            </ul>
          </section>
        </div>
      </main>

      {/* Related items */}
      <div ref={ref} className="mx-auto mt-8 max-w-6xl px-4">
        {inView && (
          <LazyComponent
            key={effectiveProductId}
            productId={effectiveProductId}
            product={currentProduct}
            showSeller={false}
          />
        )}
      </div>

      {/* Phone: sticky action bar */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <PriceTag price={price} originalPrice={originalPrice} size="md" />
            </div>
            <Button size="lg" onClick={openMessage} className="shrink-0">
              <MessageCircle />
              Message seller
            </Button>
          </div>
        </div>
      )}

      {/* Phone: message sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Message {sellerFirstName}</SheetTitle>
            <SheetDescription>Ask about “{name}”. Tap a quick question or write your own.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{composer}</div>
        </SheetContent>
      </Sheet>

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className='max-w-4xl w-[90vw] md:w-[85vw] p-0 bg-white border-gray-200'>
          <DialogTitle className='sr-only'>Product image viewer</DialogTitle>
          <DialogClose className='absolute right-3 top-3 z-50 rounded-full bg-black/60 hover:bg-black/80 p-2.5 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white'>
            <X className='h-5 w-5 text-white' />
            <span className='sr-only'>Close</span>
          </DialogClose>
          <div className='relative w-full'>

            {/* Image Container */}
            <div className='relative w-full bg-gray-50 rounded-lg overflow-hidden'>
              <div className='relative w-full' style={{ minHeight: '300px', maxHeight: '80vh' }}>
                {selectedImage ? (
                  <div className='relative w-full h-full flex items-center justify-center p-4 md:p-8'>
                    <Image
                      src={selectedImage}
                      alt={name}
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
              {images && images.length > 1 && (
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
            {images && images.length > 1 && (
              <div className='p-4 bg-white border-t'>
                <div className='flex items-center justify-center gap-2 mb-3'>
                  <span className='text-sm text-gray-600 font-medium'>
                    {images.findIndex((img) => (img.url || img) === selectedImage) + 1} / {images.length}
                  </span>
                </div>
                <div className='flex justify-center gap-2 overflow-x-auto pb-2'>
                  {images.map((image, index) => {
                    const imgSrc = image.url || image;
                    return (
                      <div
                        key={index}
                        className={`relative w-14 h-14 md:w-16 md:h-16 rounded-md overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 ${
                          selectedImage === imgSrc
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-400'
                        }`}
                        onClick={() => setSelectedImage(imgSrc)}
                      >
                        <Image
                          src={imgSrc}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className='object-cover'
                          sizes='64px'
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
