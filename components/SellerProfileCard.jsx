"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, MessageCircleCode, Share, Crown, Sparkles, Shield } from "lucide-react";
import SellerProfileSkeleton from "./ui/SellerProfileSkeleton";

const icons = [
  { name: "Facebook", component: Facebook },
  { name: "Instagram", component: Instagram },
  { name: "MessageCircleCode", component: MessageCircleCode },
  { name: "Share", component: Share, isLink: true },
];

export default function SellerProfileCard({ sellerInfo, subscriptionBadge }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!sellerInfo);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sellerInfo) return;

    const fetchCurrentUser = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("No authenticated user");

        const q = query(
          collection(db, "users"),
          where("uid", "==", currentUser.uid)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          setUser(snapshot.docs[0].data());
        } else {
          setError("User not found");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [sellerInfo]);

  useEffect(() => {
    const storeShopLink = async () => {
      if (!sellerInfo && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const link = `${window.location.origin}/shop/${uid}`;
        const userRef = doc(db, "users", uid);

        const userSnap = await getDoc(userRef);
        const existingLink = userSnap.data()?.shopLink;

        if (existingLink !== link) {
          try {
            await updateDoc(userRef, { shopLink: link });
          } catch (err) {
            console.error("Failed to update shop link:", err.message);
          }
        }
      }
    };

    storeShopLink();
  }, [sellerInfo]);

  if (loading) {
    return <SellerProfileSkeleton />;
  }
  const selectedUser = sellerInfo || user;

  if (error || !selectedUser) {
    return (
      <div className="flex items-center gap-2 text-red-500 mt-4">
        <AlertTriangle size={20} />
        <span>{error || "User not found"}</span>
      </div>
    );
  }

  const { profilePicture, fullName, createdAt, address } = selectedUser;
  const yearCreated = createdAt ? new Date(createdAt).getFullYear() : "Unknown";

  const shopUrl =
    !sellerInfo && typeof window !== "undefined"
      ? `${window.location.origin}/shop/${auth.currentUser?.uid}`
      : "";

  return (
    <Card className="mb-2">
      <CardContent className="p-4">
        <div className="flex flex-col items-center gap-4">
          {/* Profile Image with Badge Ring */}
          <div className="relative">
            <div 
              className={`w-24 h-24 rounded-full p-1 ${
                subscriptionBadge 
                  ? subscriptionBadge.label === 'VIP' 
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                    : subscriptionBadge.label === 'Premium'
                    ? 'bg-blue-500'
                    : subscriptionBadge.label === 'Bundle'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    : 'bg-gray-200'
                  : 'bg-gray-200'
              }`}
            >
              <div className="relative w-full h-full rounded-full overflow-hidden bg-white">
                <Image
                  src={profilePicture || "/placeholder.svg?height=96&width=96"}
                  alt="Profile"
                  fill
                  className="object-cover"
                  sizes="88px"
                />
              </div>
            </div>
            
            {/* Badge Icon Overlay */}
            {subscriptionBadge && subscriptionBadge.icon && (
              <div 
                className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${subscriptionBadge.className}`}
                style={subscriptionBadge.style}
              >
                <subscriptionBadge.icon className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* User Info - Always Centered */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900">{fullName || "Seller"}</h2>
            <p className="text-sm text-gray-500 mt-1">Member since {yearCreated}</p>
            <p className="text-sm text-gray-500">{address || "No address provided"}</p>
            
            {/* Subscription Badge Label */}
            {subscriptionBadge && (
              <Badge 
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold ${subscriptionBadge.className}`}
                style={subscriptionBadge.style}
              >
                {subscriptionBadge.icon && <subscriptionBadge.icon className="h-3 w-3" />}
                {subscriptionBadge.label}
              </Badge>
            )}
          </div>

          {/* Social Icons */}
          <div className="flex gap-4">
            {icons.map(({ name, component: Icon, isLink }) => {
              if (sellerInfo && isLink) return null;

              return isLink ? (
                <button
                  key={name}
                  onClick={() => {
                    navigator.clipboard.writeText(shopUrl);
                    toast.success("Your shop link has been copied!");
                  }}
                  title="Copy your shop link"
                >
                  <Icon className="cursor-pointer hover:text-blue-600" />
                </button>
              ) : (
                <Icon
                  key={name}
                  className="cursor-pointer hover:text-blue-600"
                />
              );
            })}
          </div>

          {/* Only show Edit Profile button if it's the user's own profile */}
          {!sellerInfo && (
            <Button
              variant="outline"
              onClick={() => router.push("/edit-profile")}
              className="w-full sm:w-auto"
            >
              Edit Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// {!sellerInfo && shopUrl && (
//   <Button
//     variant="secondary"
//     onClick={() => router.push(shopUrl)}
//     className="ml-4"
//   >
//     View My Shop
//   </Button>
// )}
