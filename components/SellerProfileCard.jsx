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
import { Facebook, Instagram, MessageCircleCode, Share } from "lucide-react";
import SellerProfileSkeleton from "./ui/SellerProfileSkeleton";

const icons = [
  { name: "Facebook", component: Facebook },
  { name: "Instagram", component: Instagram },
  { name: "MessageCircleCode", component: MessageCircleCode },
  { name: "Share", component: Share, isLink: true },
];

export default function SellerProfileCard({ sellerInfo }) {
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
      <CardContent className="p-2">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden">
            <Image
              src={profilePicture || "/placeholder.svg?height=96&width=96"}
              alt="Profile"
              fill
              className="object-cover bg-gray-50"
              sizes="96px"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold">{fullName || "Seller"}</h2>
            <p className="text-gray-500">Member since {yearCreated}</p>
            <p className="text-gray-500">{address || "No address provided"}</p>
          </div>
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
