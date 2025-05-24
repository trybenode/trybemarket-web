"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Send } from "lucide-react";

export default function ChatPage({ params }) {
  const router = useRouter();
  const { conversationId, otherUserId, productDetails } = router.query;
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);

  const messagesEndRef = useRef(null);

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


  useEffect(() => {
    if (productDetails) {
      try {
        setProduct(JSON.parse(productDetails));
      } catch (error) {
        console.error("Invalid productDetails JSON", error);
      }
    }
  }, [productDetails]);

    const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId) return;

    try {
      const messageObj = {
        senderID: currentUserId,
        text: newMessage,
        timestamp: Date.now(),
      };
      await addMessageToConversation(messageObj, conversationId);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to send message',
      });
    }
  };

  // Fetch conversation and messages
  useEffect(() => {
    if (conversationId) {
      const unsubscribe = getConversationWithID(conversationId, setConversation);
      return () => unsubscribe();
    }
  }, [conversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId || !conversation) return;

    try {
      setSending(true);
      // Demo send; replace with Firestore write
      const newMsg = {
        id: `msg${messages.length + 1}`,
        text: newMessage.trim(),
        senderId: currentUserId,
        timestamp: Date.now(),
      };
      setMessages([...messages, newMsg]);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (ts) => {
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

  // Group messages by date
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
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

      <Card className="mb-4">
        <CardHeader className="p-4">
          <div className="flex items-center">
            <div className="relative h-16 w-16 rounded-lg overflow-hidden">
              <Image
                src={conversation?.product.imageUrl || "/placeholder.svg"}
                alt={conversation?.product.name || "Product"}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
            <div className="ml-4">
              <CardTitle className="text-lg">
                {conversation?.product.name}
              </CardTitle>
              <Button
                variant="link"
                className="p-0 h-auto text-sm text-blue-600"
                onClick={() =>
                  router.push(`/listing/${conversation?.product.id}`)
                }
              >
                View Product
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="bg-gray-50 rounded-lg border border-gray-200 mb-4">
        <div className="h-[400px] overflow-y-auto p-4">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex justify-center my-4">
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                  {date}
                </span>
              </div>
              {msgs.map((msg) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-4 ${
                      isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isMe && (
                      <div className="relative h-8 w-8 rounded-full overflow-hidden mr-2">
                        <Image
                          src={otherUser?.avatar || "/placeholder.svg"}
                          alt={otherUser?.name || "User"}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      </div>
                    )}
                    <div className="max-w-[70%]">
                      <div
                        className={`p-3 rounded-lg ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-white border border-gray-200 rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm">{msg.text}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <Separator />

        <form onSubmit={handleSendMessage} className="p-4 flex">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 mr-2"
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
