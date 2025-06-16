"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { getAllConversations } from "@/utils/messaginghooks";
import UserProfile from "@/components/UserProfile";
import useUserStore from "@/lib/userStore";


export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const getUserID = useUserStore((state) => state.getUserId); 
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
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
  }, []); // Removed router from dependencies

  // Fetch conversations

  useEffect(() => {
    let unsubscribeListener = null;

    if (currentUserId) {
      setLoading(true);
      getAllConversations(currentUserId, setConversations)
        .then((unsubscribe) => {
          unsubscribeListener = unsubscribe;
          setLoading(false);
          // console.log("Conversation ID", conversations);
        })
        .catch((error) => {
          console.error("Error setting up conversation listener:", error);
          setLoading(false);
        });
    }

    return () => {
      if (unsubscribeListener) {
        unsubscribeListener();
      }
    };
  }, [currentUserId]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "short" });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const truncateText = (text, maxLength = 30) => {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <UserProfile />
      </div>

      {conversations.length > 0 ? (
        <div className="space-y-4">
          {[...conversations]
            .sort((a, b) => {
              // Sort by updatedAt timestamp or lastMessage timestamp
              const timeA =
                a.updatedAt?.seconds || a.lastMessage?.timestamp || 0;
              const timeB =
                b.updatedAt?.seconds || b.lastMessage?.timestamp || 0;
              return timeB - timeA; // Descending order
            })
            .map((conversation) => {
              const hasUnread =
                Array.isArray(conversation.unreadBy) &&
                conversation.unreadBy.includes(currentUserId || "");
              // console.log("Conversation ID", conversation.id);

              return (
                <Card
                  key={conversation.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent
                    className="p-4"
                    onClick={() => {
                      router.push(`/chat/${conversation.id}`);
                    }}
                  >
                    <div className="flex items-center">
                      <div className="relative h-12 w-12 rounded-lg overflow-hidden">
                        <Image
                          src={
                            conversation.product.imageUrl || "/placeholder.svg"
                          }
                          alt={conversation.product.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                        {hasUnread && (
                          <div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-blue-500" />
                        )}
                      </div>

                      <div className="ml-4 flex-1">
                        <h3 className={hasUnread ? "font-bold" : "font-normal"}>
                          {conversation.product.name}
                        </h3>
                        <p
                          className={`${
                            hasUnread ? "text-gray-900" : "text-gray-500"
                          } text-sm truncate`}
                        >
                          {truncateText(conversation.lastMessage?.text)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {formatTimestamp(
                            conversation.lastMessage?.timestamp || 0
                          )}
                        </p>
                        <p className="text-xs text-blue-500 mt-1">
                          { conversation.instigatorInfo?.id === currentUserId ? " " : conversation.instigatorInfo?.name || "Unknown Buyer" }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="mb-4 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            No Messages Yet
          </h2>
          <p className="text-gray-500 max-w-md">
            When you start conversations with sellers or buyers, they'll appear
            here
          </p>
          <Button className="mt-6" onClick={() => router.push("/")}>
            Browse Products
          </Button>
        </div>
      )}
    </div>
  );
}
