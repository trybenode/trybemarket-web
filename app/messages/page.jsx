"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { getAllConversations } from "@/utils/messaginghooks";

import Header from "@/components/Header";
import { MessageCircle } from "lucide-react";

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
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

  const sorted = [...conversations].sort((a, b) => {
    const timeA = a.updatedAt?.seconds || a.lastMessage?.timestamp || 0;
    const timeB = b.updatedAt?.seconds || b.lastMessage?.timestamp || 0;
    return timeB - timeA; // newest first
  });
  const isUnread = (c) => Array.isArray(c.unreadBy) && c.unreadBy.includes(currentUserId || "");
  const unreadCount = sorted.filter(isUnread).length;
  const visible = filter === "unread" ? sorted.filter(isUnread) : sorted;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Messages" />
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Messages" />

      <div className="mx-auto max-w-3xl px-4 py-4">
        {sorted.length > 0 && (
          <div className="mb-3 flex gap-2">
            {[
              ["all", "All", sorted.length],
              ["unread", "Unread", unreadCount],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition active:scale-95",
                  filter === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {label}
                <span className={cn("ml-1.5 text-xs tabular-nums", filter === key ? "text-white/80" : "text-slate-400")}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {visible.length > 0 ? (
          <ul className="space-y-2">
            {visible.map((conversation) => {
              const hasUnread = isUnread(conversation);
              const buyerName =
                conversation.instigatorInfo?.id === currentUserId
                  ? null
                  : conversation.instigatorInfo?.name || "Unknown buyer";

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/chat/${conversation.id}`)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition active:scale-[0.99]",
                      hasUnread
                        ? "border-primary/25 bg-blue-50/60 hover:bg-blue-50"
                        : "border-slate-200/80 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <Image
                        src={conversation.product?.imageUrl || "/placeholder.svg"}
                        alt={conversation.product?.name || "Listing"}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className={cn("truncate text-sm", hasUnread ? "font-bold text-slate-900" : "font-semibold text-slate-800")}>
                          {conversation.product?.name}
                        </h3>
                        <span className={cn("shrink-0 text-xs tabular-nums", hasUnread ? "font-semibold text-primary" : "text-slate-400")}>
                          {formatTimestamp(conversation.lastMessage?.timestamp || 0)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn("min-w-0 flex-1 truncate text-sm", hasUnread ? "font-medium text-slate-900" : "text-slate-500")}>
                          {conversation.lastMessage?.imageUrl && !conversation.lastMessage?.text
                            ? "📷 Photo"
                            : truncateText(conversation.lastMessage?.text, 60)}
                        </p>
                        {hasUnread && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        )}
                      </div>
                      {buyerName && <p className="mt-0.5 truncate text-xs text-slate-400">from {buyerName}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {filter === "unread" ? "You're all caught up" : "No messages yet"}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {filter === "unread"
                ? "No unread conversations right now."
                : "When you start a conversation with a seller or a buyer, it will show up here."}
            </p>
            {filter === "unread" ? (
              <Button variant="soft" className="mt-6" onClick={() => setFilter("all")}>
                Show all conversations
              </Button>
            ) : (
              <Button size="lg" className="mt-6" onClick={() => router.push("/")}>
                Browse products
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
