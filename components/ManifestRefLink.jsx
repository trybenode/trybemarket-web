"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getStoredReferralCode } from "@/lib/referralClient";
import { normalizeReferralCode } from "@/lib/crsaConstants";

const DEFAULT_MANIFEST = "/manifest.webmanifest";

/**
 * Points <link rel="manifest"> at /pwa-manifest?ref=CODE while the visitor
 * has an ambassador's referral code (in the URL or captured earlier), so an
 * "Add to Home Screen" from ANY page produces an app that launches with the
 * code in its start_url. Mounted in the root layout next to ReferralCapture —
 * a code can arrive on any page, and people install from wherever they are —
 * not on /install alone. Safari and Chrome read the manifest link when the
 * user installs, not at page load, so swapping it after load is honoured.
 * Renders nothing.
 */
export default function ManifestRefLink() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlRef = searchParams.get("ref");

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const code = normalizeReferralCode(urlRef) || getStoredReferralCode();
    link.setAttribute("href", code ? `/pwa-manifest?ref=${code}` : DEFAULT_MANIFEST);
  }, [urlRef, pathname]);

  return null;
}
