"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReviewForm from "@/components/ReviewForm";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

              fetch("/api/notifications/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: currentUserId, // Sender's ID - for email quota check
                  recipientId: otherUser.id, // Recipient's ID - for WhatsApp quota check
                  recipientPhone: otherUserDetails.phone,
                  recipientEmail: otherUserDetails.email,
                  recipientName: otherUserDetails.fullName || "User",
                  senderName: currentUserName || "Someone",
                  productName: product?.name || "a product",
                  chatLink: `https://trybemarket.online/chat/${conversationId}`,
                  conversationId,
                  channels,
                }),
              })
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            className="p-0 mr-2"
            onClick={() => router.push("/messages")}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Chat</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Conversation not found</p>
        </div>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <Button
          variant="ghost"
          className="p-0 mr-2"
          onClick={() => router.push("/messages")}
        >
          <ArrowLeft
            size={20}
            className="text-yellow-600 hover:text-yellow-800"
          />
        </Button>
        <h1 className="text-2xl font-bold">Chat</h1>
        <NotificationCounter userId={currentUserId} />
      </div>

      {/* Product Card */}
      {product && (
        <Card className="mb-4">
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden">
                <Image
                  src={
                    product.imageUrl || "/placeholder.svg?height=64&width=64"
                  }
                  alt={product.name || "Product"}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="ml-4">
                <CardTitle className="text-lg">
                  {product.name || "Product"}
                </CardTitle>
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm text-blue-600"
                  onClick={handleProcuctClick}
                >
                  View Product
                </Button>
              </div>
              <div>
                {/* <Button variant="ghost" onClick={() => setShowReviewForm(true)}>
                  Rate Seller
                </Button> */}
                {product?.sellerId && (
                  <ReviewForm sellerId={product.sellerId} />
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Messages Container */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 mb-4 flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex justify-center my-4">
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                    {date}
                  </span>
                </div>

                {/* Messages for this date */}
                {msgs.map((msg, index) => {
                  const isMe = msg.senderID === currentUserId;
                  return (
                    <div
                      key={`${msg.timestamp}-${index}`}
                      className={`flex mb-4 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      {!isMe && (
                        <div
                          className="relative h-8 w-8 rounded-full overflow-hidden mr-2 flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-blue-400 transition-all"
                          onClick={() => setShowUserModal(true)}
                        >
                          <Image
                            src={
                              otherUser?.avatar ||
                              "/placeholder.svg?height=32&width=32"
                            }
                            alt={otherUser?.name || "User"}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      )}
                      <div className="max-w-[70%]">
                        <div
                          className={`rounded-lg overflow-hidden ${
                            isMe
                              ? "bg-blue-600 text-white rounded-br-none"
                              : "bg-white border border-gray-200 rounded-bl-none"
                          } ${msg.imageUrl ? "p-1" : "p-3"}`}
                        >
                          {msg.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={msg.imageUrl}
                              alt="Shared image"
                              className="max-w-[220px] rounded-md cursor-pointer block"
                              onClick={() => setLightboxIndex(imageUrls.indexOf(msg.imageUrl))}
                            />
                          )}
                          {msg.text && (
                            <p className={`text-sm ${msg.imageUrl ? "mt-1 px-2 pb-1" : ""}`}>
                              {msg.text}
                            </p>
                          )}
                        </div>
                        <p
                          className={`text-xs text-gray-500 mt-1 ${isMe ? "text-right" : "text-left"}`}
                        >
                          {formatTimestamp(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <Separator />

        {/* Image preview */}
        {imagePreview && (
          <div className="px-4 pt-3 flex items-start gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Preview"
                className="h-20 w-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={removeSelectedImage}
                className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full h-5 w-5 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Image ready to send</p>
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-4 flex gap-2 items-center">
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
            className="flex-shrink-0 text-gray-500 hover:text-blue-600"
            onClick={() => imageInputRef.current?.click()}
            disabled={sending}
            title="Attach image"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
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
            disabled={sending || (!newMessage.trim() && !selectedImage)}
            className="px-3"
          >
            {sending || uploadingImage ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
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
            className="bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col items-center gap-4 shadow-xl"
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
                  {isUserRecentlyActive(otherUserDetails.lastSeen) ? "🟢 Online" : "Recently active"}
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
