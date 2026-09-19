"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureReferralCode } from "@/lib/referralClient";

/**
 * Captures ?ref=CODE from ANY page's URL into localStorage, not just
 * /signup — a CRSA's link may land someone on the homepage or a listing
 * first, and they only sign up after browsing. Renders nothing. The code is
 * only ever a claim: lib/crsaServer.js's attachReferral re-validates it
 * server-side at signup.
 */
export default function ReferralCapture() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  useEffect(() => {
    if (ref) captureReferralCode(ref);
  }, [ref]);

  return null;
}
