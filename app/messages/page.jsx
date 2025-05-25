"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { getAllConversations } from "@/utils/messaginghooks";

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
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
  useEffect(() => {
    let unsubscribeListener = null;

    if (currentUserId) {
      setLoading(true);
      getAllConversations(currentUserId, setConversations)
        .then((unsubscribe) => {
          unsubscribeListener = unsubscribe;
          setLoading(false);
          console.log("Conversation ID", conversations);
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

  // Fetch conversations
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const unsubscribe = await getAllConversations(
        currentUserId,
        setConversations
      );
      if (unsubscribe) unsubscribe(); // Clean up the listener since we just want a one-time refresh
    } catch (error) {
      console.error("Error refreshing conversations:", error);
    } finally {
      setRefreshing(false);
    }
  };

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
        {/* <Button variant="outline" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button> */}
      </div>

      {conversations.length > 0 ? (
        <div className="space-y-4">
          {conversations.map((conversation) => {
            const hasUnread =
              Array.isArray(conversation.unreadBy) &&
              conversation.unreadBy.includes(currentUserId || "");
              console.log("Conversation ID", conversation.id);

            return (
              <Card
                key={conversation.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
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
                        } text-sm`}
                      >
                        {conversation.lastMessage?.text}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {formatTimestamp(
                          conversation.lastMessage?.timestamp || 0
                        )}
                      </p>
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs text-blue-600"                        
                        onClick={() => {
                          router.push(`/chat/${conversation.id}`)
                        }}
                      >
                        View
                      </Button>
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
