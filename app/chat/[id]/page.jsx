"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReviewForm from "@/components/ReviewForm";
import SaleConfirmationPanel from "@/components/SaleConfirmationPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronLeft, Send, Paperclip, X, ChevronRight } from "lucide-react";
import { compressImage } from "@/utils/compressImage";
import {
  getConversationWithID,
  addMessageToConversation,
  getUserInfo,
} from "@/utils/messaginghooks";
import { isUserRecentlyActive, useLastSeen } from "@/hooks/useLastSeen";
import useUserStore from "@/lib/userStore";
import NotificationCounter from "@/components/NotificationCounter";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useSubscription } from "@/hooks/useSubscription";
import { sendMessageNotification } from "@/lib/notificationClient";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [otherUserDetails, setOtherUserDetails] = useState(null);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // index into imageUrls array
  const [showUserModal, setShowUserModal] = useState(false);

  const messagesEndRef = useRef(null);
  const imageInputRef = useRef(null);
  const currentUserName = useUserStore((state) => state.getUserFullName());
  const { subscription } = useSubscription(currentUserId);

  // Track current user's activity
  useLastSeen(currentUserId);

  // Check if user is authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCurrentUserId(user.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Collect all image URLs from messages for gallery navigation
  const imageUrls = messages
    .filter((m) => m.imageUrl)
    .map((m) => m.imageUrl);

  const uploadImageToCloudinary = async (file) => {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("upload_preset", "ProductImage");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    );
    const data = await response.json();
    if (!data.secure_url) throw new Error("Upload failed");
    return data.secure_url.replace("/upload/", "/upload/q_auto,f_auto,w_1200/");
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Only JPEG, PNG, GIF, or WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB.");
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !currentUserId || sending) return;

    setSending(true);
    try {
      let imageUrl = null;
      if (selectedImage) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadImageToCloudinary(selectedImage);
        } finally {
          setUploadingImage(false);
        }
        setSelectedImage(null);
        setImagePreview(null);
      }

      const messageObj = {
        senderID: currentUserId,
        text: newMessage.trim(),
        timestamp: Date.now(),
        ...(imageUrl && { imageUrl, type: "image" }),
      };

      await addMessageToConversation(messageObj, conversationId);
      setNewMessage("");

      // Send notification if recipient is offline
      if (otherUserDetails) {
        // Check if recipient is active (within last 5 minutes)
        const isRecipientActive = otherUserDetails.lastSeen
          ? isUserRecentlyActive(otherUserDetails.lastSeen)
          : false;

        console.log("Recipient active?", isRecipientActive);

        if (!isRecipientActive) {
          // Check for debounce (only notify once per 5 minutes)
          const lastNotified =
            otherUserDetails.lastNotifiedAt?.toMillis?.() || 0;
          const fiveMinutes = 5 * 60 * 1000;
          const shouldNotify = Date.now() - lastNotified > fiveMinutes;

          if (shouldNotify) {
            // Determine which channels to use based on opt-ins
            const channels = [];
            if (
              otherUserDetails.whatsappNotifications &&
              otherUserDetails.phone
            ) {
              channels.push("whatsapp");
            }
            if (
              otherUserDetails.emailNotifications !== false &&
              otherUserDetails.email
            ) {
              // Default to true if not set
              channels.push("email");
            }

            if (channels.length > 0) {
              console.log("Sending notifications via:", channels);

              sendMessageNotification({ conversationId, channels, productName: product?.name || "a product" })
                .then(async (response) => {
                  const data = await response.json();

                  console.log(
                    "Notification API response status:",
                    response.status,
                  );
                  console.log("Notification API response data:", data);

                  if (response.status === 429) {
                    if (data.reason === "email_limit_reached") {
                      // Sender has reached their email limit - show upgrade prompt
                      console.log(
                        "You have reached your daily email notification limit",
                      );
                      setShowUpgradePrompt(true);
                      return;
                    }
                  }

                  console.log("Notification response:", data);
                  if (data.success && data.results) {
                    console.log("Notification sent successfully.");
                    console.log(
                      "Email sent - Remaining:",
                      data.emailSent?.remaining,
                      "Limit:",
                      data.emailSent?.limit,
                    );
                    console.log(
                      "WhatsApp blocked?",
                      data.results?.whatsappBlocked,
                    );
                    // lastNotifiedAt is now updated server-side in the API route
                  }
                })
                .catch((error) => {
                  console.error("Notification error:", error);
                });
            }
          } else {
            console.log("Skipping notification - recently notified");
          }
        } else {
          console.log("Recipient is online, skipping notification");
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // You can add toast notification here if you have it set up
    } finally {
      setSending(false);
    }
  };

  // Fetch conversation and messages
  useEffect(() => {
    if (!conversationId) return;

    // console.log("Fetching conversation with ID:", conversationId)

    const unsubscribe = getConversationWithID(
      conversationId,
      (conversationData) => {
        // console.log("Conversation data received:", conversationData)
        setConversation(conversationData);

        if (conversationData) {
          setProduct(conversationData.product || null);
          setMessages(conversationData.messages || []);

          // Set other user info
          if (conversationData.participants && currentUserId) {
            const otherUserId = conversationData.participants.find(
              (id) => id !== currentUserId,
            );
            setOtherUser({
              id: otherUserId,
              name: "Other User",
              avatar: "/placeholder.svg",
            });

            // Fetch full user details including email and lastSeen
            getUserInfo(otherUserId)
              .then((userInfo) => {
                if (userInfo) {
                  // console.log("Fetched other user details:", userInfo)
                  setOtherUserDetails(userInfo);
                  setOtherUser({
                    id: otherUserId,
                    name: userInfo.fullName || "Other User",
                    avatar: userInfo.profilePicture || "/placeholder.svg",
                  });
                }
              })
              .catch((error) => {
                console.error("Error fetching other user details:", error);
              });
          }
        }

        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [conversationId, currentUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const handleProcuctClick = () => {
    // Prefer persona from product, then conversation, fallback to product
    const personaValue = product?.persona || conversation?.persona || null;
    if (personaValue === "service_provider") {
      router.push(`/view-service/${product.id}`);
    } else {
      router.push(`/listing/${product.id}`);
    }
  };


  const groupedMessages = messages.reduce((groups, message) => {
    const dateLabel = formatDate(message.timestamp);
    if (!groups[dateLabel]) groups[dateLabel] = [];
    groups[dateLabel].push(message);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col bg-slate-50 md:mx-auto md:my-4 md:h-[calc(100dvh-2rem)] md:max-w-3xl md:overflow-hidden md:rounded-3xl md:border md:border-slate-200 md:bg-white" aria-busy="true">
        <div className="flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-10 w-3/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <button
            onClick={() => router.push("/messages")}
            aria-label="Back to messages"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-slate-900">Chat</h1>
        </div>
        <div className="px-4 py-20 text-center">
          <p className="text-slate-500">This conversation couldn't be found.</p>
          <Button className="mt-4" variant="soft" onClick={() => router.push("/messages")}>
            Back to messages
          </Button>
        </div>
      </div>
    );
  }

  const otherOnline = otherUserDetails?.lastSeen ? isUserRecentlyActive(otherUserDetails.lastSeen) : false;

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-50 md:mx-auto md:my-4 md:h-[calc(100dvh-2rem)] md:max-w-3xl md:overflow-hidden md:rounded-3xl md:border md:border-slate-200 md:bg-white md:shadow-sm">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:px-3">
        <button
          onClick={() => router.push("/messages")}
          aria-label="Back to messages"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>

        <button
          type="button"
          onClick={() => setShowUserModal(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-yellow-soft">
            {otherUser?.avatar && !otherUser.avatar.startsWith("/placeholder") ? (
              <Image src={otherUser.avatar} alt={otherUser?.name || "User"} fill className="object-cover" sizes="36px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-700">
                {(otherUser?.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-900">{otherUser?.name || "Chat"}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              {otherOnline && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              {otherOnline ? "Online now" : "Tap for profile"}
            </span>
          </span>
        </button>

        <NotificationCounter userId={currentUserId} />
      </header>

      {/* Listing context */}
      {product && (
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <Image
              src={product.imageUrl || "/placeholder.svg?height=44&width=44"}
              alt={product.name || "Listing"}
              fill
              className="object-cover"
              sizes="44px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{product.name || "Listing"}</p>
            <button type="button" onClick={handleProcuctClick} className="text-xs font-semibold text-primary hover:underline">
              View listing
            </button>
          </div>
          {product?.sellerId && <ReviewForm sellerId={product.sellerId} />}
        </div>
      )}

      <div className="empty:hidden shrink-0 px-3 pt-2">
        <SaleConfirmationPanel
          conversationId={conversationId}
          conversation={conversation}
          currentUserId={currentUserId}
        />
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {Object.keys(groupedMessages).length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-slate-500">No messages yet. Say hello and start the conversation!</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-slate-200/70 px-3 py-1 text-xs font-medium text-slate-600">{date}</span>
              </div>

              {msgs.map((msg, index) => {
                const isMe = msg.senderID === currentUserId;
                const next = msgs[index + 1];
                const prev = msgs[index - 1];
                const endsGroup = !next || next.senderID !== msg.senderID;
                const startsGroup = !prev || prev.senderID !== msg.senderID;
                return (
                  <div
                    key={`${msg.timestamp}-${index}`}
                    className={cn("flex items-end gap-2", isMe ? "justify-end" : "justify-start", startsGroup ? "mt-3" : "mt-0.5")}
                  >
                    {!isMe && (
                      <span className="w-7 shrink-0">
                        {endsGroup && (
                          <button
                            type="button"
                            onClick={() => setShowUserModal(true)}
                            className="relative block h-7 w-7 overflow-hidden rounded-full bg-brand-yellow-soft"
                            aria-label={`${otherUser?.name || "User"}'s profile`}
                          >
                            {otherUser?.avatar && !otherUser.avatar.startsWith("/placeholder") ? (
                              <Image src={otherUser.avatar} alt="" fill className="object-cover" sizes="28px" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-700">
                                {(otherUser?.name || "?").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </button>
                        )}
                      </span>
                    )}
                    <div className={cn("flex max-w-[78%] flex-col", isMe ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "overflow-hidden text-sm leading-relaxed shadow-sm",
                          isMe
                            ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-900",
                          msg.imageUrl ? "p-1" : "px-3.5 py-2"
                        )}
                      >
                        {msg.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={msg.imageUrl}
                            alt="Shared image"
                            className="block max-w-[220px] cursor-pointer rounded-xl"
                            onClick={() => setLightboxIndex(imageUrls.indexOf(msg.imageUrl))}
                          />
                        )}
                        {msg.text && (
                          <p className={cn("whitespace-pre-wrap break-words", msg.imageUrl && "px-2.5 pb-1.5 pt-1.5")}>{msg.text}</p>
                        )}
                      </div>
                      {endsGroup && (
                        <p className="mt-1 px-1 text-[11px] tabular-nums text-slate-400">{formatTimestamp(msg.timestamp)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {imagePreview && (
          <div className="mb-2 flex items-start gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={removeSelectedImage}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Photo ready to send</p>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500 hover:text-primary"
            onClick={() => imageInputRef.current?.click()}
            disabled={sending}
            aria-label="Attach a photo"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="h-11 flex-1 rounded-full border-slate-200 bg-slate-50 px-4"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            loading={sending || uploadingImage}
            disabled={!newMessage.trim() && !selectedImage}
            aria-label="Send message"
          >
            {!(sending || uploadingImage) && <Send />}
          </Button>
        </form>
      </div>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        currentPlan={
          subscription?.product?.planId ||
          subscription?.service?.planId ||
          subscription?.bundle?.planId ||
          "product_free"
        }
      />

      {/* Image gallery lightbox */}
      {lightboxIndex !== null && imageUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-gray-800 rounded-full h-9 w-9 flex items-center justify-center hover:bg-gray-700 z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {imageUrls.length > 1 && (
            <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full z-10">
              {lightboxIndex + 1} / {imageUrls.length}
            </span>
          )}

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              className="absolute left-3 text-white bg-black/50 rounded-full h-10 w-10 flex items-center justify-center hover:bg-black/80 z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i - 1); }}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrls[lightboxIndex]}
            alt={`Image ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightboxIndex < imageUrls.length - 1 && (
            <button
              type="button"
              className="absolute right-3 text-white bg-black/50 rounded-full h-10 w-10 flex items-center justify-center hover:bg-black/80 z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i + 1); }}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}

      {/* Other user profile modal */}
      {showUserModal && otherUser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="relative bg-white rounded-3xl w-full max-w-sm p-6 flex flex-col items-center gap-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
              onClick={() => setShowUserModal(false)}
            >
              <X className="h-5 w-5" />
            </button>

            {/* Avatar */}
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-blue-100">
              <Image
                src={otherUser.avatar || "/placeholder.svg?height=80&width=80"}
                alt={otherUser.name || "User"}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>

            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{otherUser.name || "Unknown User"}</p>
              {otherUserDetails?.lastSeen && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {isUserRecentlyActive(otherUserDetails.lastSeen) ? "Online now" : "Recently active"}
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setShowUserModal(false);
                router.push(`/shop/${otherUser.id}`);
              }}
            >
              View their shop
            </Button>

            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => setShowUserModal(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
