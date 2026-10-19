"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown INSTEAD of a listing form to a user who hasn't cleared KYC (see
 * lib/kycAccess.js). It replaces a dialog that Escape dismissed, leaving the
 * form usable underneath. The real enforcement is firestore.rules — listings
 * can only be created by a KYC-cleared user — this just says why, up front.
 */
export default function KycRequiredPanel() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
        <BadgeCheck className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Verify to start selling</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only verified students can list on TrybeMarket. It takes a minute, and you'll get 150 App Credit when you're
          approved.
        </p>
        <Button asChild className="mt-5">
          <Link href="/kyc">Verify my student ID</Link>
        </Button>
      </div>
    </div>
  );
}
