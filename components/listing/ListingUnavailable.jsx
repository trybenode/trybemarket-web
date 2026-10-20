"use client";

import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown when a listing or service can't be found — deleted, or held because
 * its seller's verification ended (lib/kycHold.js moves held listings out of
 * the catalogue). Chats, favourites and shared links still point at it, so
 * this is a friendly dead end rather than a 404. Not indexed by search engines.
 */
export default function ListingUnavailable({ kind = "listing" }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <meta name="robots" content="noindex" />
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <PackageX className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">This {kind} is no longer available</h1>
      <p className="mt-1 text-sm text-slate-600">
        The seller may have removed it, or it's temporarily unavailable. There's plenty more on the marketplace.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/">Browse the marketplace</Link>
      </Button>
    </div>
  );
}
