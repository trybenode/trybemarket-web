"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, MessageCircleCode, Share } from "lucide-react";

const icons = [
  { name: "Facebook", component: Facebook },
  { name: "Instagram", component: Instagram },
  { name: "MessageCircleCode", component: MessageCircleCode },
  { name: "Share", component: Share, isLink: true },
];

export default function SellerProfileCard({ sellerInfo }) {
  const router = useRouter();
  const pathname =usePathname()
  const isOnShopScreen = pathname === '/shop';

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

  // const selectedUser = useMemo(() => {
  //   return isOnShopScreen ? sellerInfo : user;
  // }, [isOnShopScreen, sellerInfo, user]);
  const selectedUser = sellerInfo || user;

   const handleShopLink = () => {
    alert('Coming Soon! Your unique shop link feature is coming soon for premium members.');
  };

  if (loading) return <Loader className="animate-spin my-6 mx-auto" />;
  if (error || !selectedUser) {
    return (
      <div className="flex items-center gap-2 text-red-500 mt-4">
        <AlertTriangle size={20} />
        <span>{error || "User not found"}</span>
      </div>
    );
  }

  const { profilePicture, fullName, createdAt, address } = selectedUser;
  const yearCreated = createdAt
    ? new Date(createdAt).getFullYear()
    : "Unknown";

  const currentUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden">
            <Image
              src={profilePicture || "/placeholder.svg?height=96&width=96"}
              alt="Profile"
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold">{fullName || "Seller"}</h2>
            <p className="text-gray-500">Member since {yearCreated}</p>
            <p className="text-gray-500">{address || "No address provided"}</p>
          </div>
          <div className="flex gap-4">
            {icons.map(({ name, component: Icon, isLink }) =>
              isLink ? (
                <Link
                  key={name}
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon className="cursor-pointer hover:text-blue-600" />
                </Link>
              ) : (
                <Icon
                  key={name}
                  className="cursor-pointer hover:text-blue-600"
                />
              )
            )}
          </div>
          {!sellerInfo && (
            <Button variant="outline" onClick={() => router.push("/edit-profile")}>
              Edit Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
