"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Store } from "lucide-react";
import { MdVerified } from "react-icons/md";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isUserRecentlyActive } from "@/hooks/useLastSeen";

/** Who you're buying from: photo, name, verified tick, activity, and a link to their shop. */
export default function SellerCard({ seller, sellerId }) {
  if (!seller) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  const name = seller.fullName || "TrybeMarket seller";
  const active = seller.lastSeen ? isUserRecentlyActive(seller.lastSeen) : false;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <Avatar className="h-12 w-12 border border-slate-200">
        <AvatarImage src={seller.profilePicture || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="bg-brand-yellow-soft font-semibold text-slate-700">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          {seller.isVerified && (
            <MdVerified className="h-4 w-4 shrink-0 text-emerald-500" title="Verified student" aria-label="Verified student" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {active && (
            <span className="flex items-center gap-1 font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active now
            </span>
          )}
          {seller.address && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{seller.address}</span>
            </span>
          )}
        </div>
      </div>

      {sellerId && (
        <Button asChild variant="soft" size="sm" className="shrink-0">
          <Link href={`/shop/${sellerId}`}>
            <Store /> Shop
          </Link>
        </Button>
      )}
    </div>
  );
}
