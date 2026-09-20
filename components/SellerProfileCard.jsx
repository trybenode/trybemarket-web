"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import { Share } from "lucide-react";
import { Eye } from "lucide-react";
import SellerProfileSkeleton from "./ui/SellerProfileSkeleton";
import UserBadgesRow from "./UserBadgesRow";


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

  const { uid, profilePicture, fullName, createdAt, address } = selectedUser;
  // createdAt may be a Firestore Timestamp, an ISO string, a number or a Date depending on how the account was created.
  const createdDate = createdAt?.toDate ? createdAt.toDate() : createdAt ? new Date(createdAt) : null;
  const yearCreated = createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate.getFullYear() : "—";

  const shopUrl =
    !sellerInfo && typeof window !== "undefined"
      ? `${window.location.origin}/shop/${auth.currentUser?.uid}`
      : "";

  const ring =
    subscriptionBadge?.label === "VIP"
      ? "bg-gradient-to-br from-yellow-300 to-amber-500"
      : subscriptionBadge?.label === "Premium"
      ? "bg-gradient-to-br from-blue-400 to-blue-600"
      : subscriptionBadge?.label === "Bundle"
      ? "bg-gradient-to-br from-purple-400 to-indigo-500"
      : "bg-white";

  const copyShopLink = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl);
      toast.success("Shop link copied — share it anywhere");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {/* soft brand cover */}
      <div className="h-20 bg-gradient-to-r from-brand-yellow via-brand-yellow-soft to-blue-50 sm:h-24" />

      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 flex flex-col items-center gap-4 sm:-mt-10 sm:flex-row sm:items-start">
          {/* Avatar with plan ring */}
          <div className="relative shrink-0">
            <div className={`h-24 w-24 rounded-full p-1 shadow-md ring-4 ring-white ${ring}`}>
              <div className="relative h-full w-full overflow-hidden rounded-full bg-brand-yellow-soft">
                {profilePicture ? (
                  <Image
                    src={profilePicture}
                    alt={fullName ? `${fullName}'s photo` : "Profile"}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-700">
                    {(fullName || "S").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            {subscriptionBadge?.icon && (
              <div
                className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full shadow-lg ring-2 ring-white ${subscriptionBadge.className}`}
                style={subscriptionBadge.style}
              >
                <subscriptionBadge.icon className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:mt-11 sm:text-left">
            <h2 className="truncate text-xl font-bold text-slate-900">{fullName || "Seller"}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {address || "No address provided"} · Member since {yearCreated}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              {subscriptionBadge && (
                <Badge
                  className={`gap-1.5 border-0 px-3 py-1 text-xs font-semibold ${subscriptionBadge.className}`}
                  style={subscriptionBadge.style}
                >
                  {subscriptionBadge.icon && <subscriptionBadge.icon className="h-3 w-3" />}
                  {subscriptionBadge.label}
                </Badge>
              )}
              {/* Earned achievement badges (Verified Student, Founding Member, Top Seller) */}
              <UserBadgesRow userId={uid} />
            </div>
          </div>

          {/* Only the owner sees these */}
          {!sellerInfo && (
            <div className="flex w-full gap-2 sm:mt-11 sm:w-auto">
              <Button variant="soft" onClick={copyShopLink} className="flex-1 sm:flex-none" title="Copy your shop link">
                <Share /> Share shop
              </Button>
              <Button variant="outline" onClick={() => router.push("/edit-profile")} className="flex-1 sm:flex-none">
                Edit profile
              </Button>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Eye className="h-3.5 w-3.5" /> Shop views
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
              {selectedUser.shopViewCount || 0}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Member since</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{yearCreated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
