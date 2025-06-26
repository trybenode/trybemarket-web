"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ReviewForm from "@/components/ReviewForm"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ChevronLeft, Send } from "lucide-react"
import { getConversationWithID, addMessageToConversation } from "@/utils/messaginghooks"

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = params.id

  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [otherUser, setOtherUser] = useState(null)

  const [showReviewForm, setShowReviewForm] = useState(false);

  const messagesEndRef = useRef(null)

  // Check if user is authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login")
      } else {
        setCurrentUserId(user.uid)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUserId || sending) return

    setSending(true)
    try {
      const messageObj = {
        senderID: currentUserId,
        text: newMessage.trim(),
        timestamp: Date.now(),
      }

      await addMessageToConversation(messageObj, conversationId)
      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      // You can add toast notification here if you have it set up
    } finally {
      setSending(false)
    }
  }

  // Fetch conversation and messages
  useEffect(() => {
    if (!conversationId) return

    console.log("Fetching conversation with ID:", conversationId)

    const unsubscribe = getConversationWithID(conversationId, (conversationData) => {
      console.log("Conversation data received:", conversationData)
      setConversation(conversationData)

      if (conversationData) {
        setProduct(conversationData.product || null)
        setMessages(conversationData.messages || [])

        // Set other user info
        if (conversationData.participants && currentUserId) {
          const otherUserId = conversationData.participants.find((id) => id !== currentUserId)
          // You might want to fetch user details here
          setOtherUser({ id: otherUserId, name: "Other User", avatar: "/placeholder.svg" })
        }
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [conversationId, currentUserId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const formatTimestamp = (ts) => {
    if (!ts) return ""
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const formatDate = (ts) => {
    if (!ts) return ""
    const date = new Date(ts)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return "Today"
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
  }

  const handleProcuctClick = () => {
    // Prefer persona from product, then conversation, fallback to product
    const personaValue = product?.persona || conversation?.persona || null;
    if (personaValue === "service_provider") {
      router.push(`/view-service/${product.id}`);
    } else {
      router.push(`/listing/${product.id}`);
    }
  }
  // {showReviewForm && (
  //   <ReviewForm sellerId={product.sellerId} />
  // )}
  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const dateLabel = formatDate(message.timestamp)
    if (!groups[dateLabel]) groups[dateLabel] = []
    groups[dateLabel].push(message)
    return groups
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="p-0 mr-2" onClick={() => router.push("/messages")}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Chat</h1>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Conversation not found</p>
        </div>
      </div>
    )
  }
  // console.log("Product loaded:", product);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="p-0 mr-2" onClick={() => router.push("/messages")}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold">Chat</h1>
      </div>

      {/* Product Card */}
      {product && (
        <Card className="mb-4">
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <div className="relative h-16 w-16 rounded-lg overflow-hidden">
                <Image
                  src={product.imageUrl || "/placeholder.svg?height=64&width=64"}
                  alt={product.name || "Product"}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div className="ml-4">
                <CardTitle className="text-lg">{product.name || "Product"}</CardTitle>
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
      <div className="bg-gray-50 rounded-lg border border-gray-200 mb-4">
        <div className="h-[400px] overflow-y-auto p-4">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex justify-center my-4">
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{date}</span>
                </div>

                {/* Messages for this date */}
                {msgs.map((msg, index) => {
                  const isMe = msg.senderID === currentUserId
                  return (
                    <div
                      key={`${msg.timestamp}-${index}`}
                      className={`flex mb-4 ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      {!isMe && (
                        <div className="relative h-8 w-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                          <Image
                            src={otherUser?.avatar || "/placeholder.svg?height=32&width=32"}
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
                        <p className={`text-xs text-gray-500 mt-1 ${isMe ? "text-right" : "text-left"}`}>
                          {formatTimestamp(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <Separator />

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-4 flex gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
              }
            }}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()} className="px-3">
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
