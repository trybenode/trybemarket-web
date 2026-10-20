"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { isProvisionalExpired } from "@/lib/kycAccess";

/**
 * Shown INSTEAD of a listing form to a user who hasn't cleared KYC (see
 * lib/kycAccess.js). It replaces a dialog that Escape dismissed, leaving the
 * form usable underneath. The real enforcement is firestore.rules — listings
 * can only be created by a KYC-cleared user — this just says why, up front.
 */
export default function KycRequiredPanel() {
  const { currentUser } = useUser() || {};
  // A fresher whose provisional deadline passed: their listings are held
  // until they verify with a student ID.
  const expired = isProvisionalExpired(currentUser);
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
        <BadgeCheck className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">
          {expired ? "Submit your student ID to keep selling" : "Verify to start selling"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {expired
            ? "Your provisional verification has ended. Submit your student ID card to make your listings available again and resume your plan."
            : "Only verified students can list on TrybeMarket. Use your student ID card — or, if you're a 100 or 200 level fresher without one yet, your portal screenshot or library card."}
        </p>
        <Button asChild className="mt-5">
          <Link href="/kyc">{expired ? "Submit my student ID" : "Verify now"}</Link>
        </Button>
      </div>
    </div>
  );
}
