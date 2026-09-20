"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, X } from "lucide-react";
import { usePwa } from "@/context/PwaContext";
import { useUser } from "@/context/UserContext";
import {
  PROMPT_DELAY_MS,
  PROMPT_MIN_VISITS,
  PROMPT_SNOOZE_MS,
  STORAGE_KEYS,
  safeGet,
  safeSet,
} from "@/lib/pwa";
import { getArrivalRef } from "@/lib/installGate";
import { trackEvent, EVENT_TYPES } from "@/utils/analytics";

// Never interrupt sign-in, payment, verification or a conversation.
const SUPPRESSED_PREFIXES = ["/login", "/signup", "/subscription", "/kyc", "/chat", "/install", "/select-university"];

function isSuppressed(pathname) {
  return SUPPRESSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Dismissible bottom sheet inviting mobile visitors to install. Shown only
 * after PROMPT_MIN_VISITS sessions and a short delay, snoozed a week after a
 * dismissal, and never when already installed, in an in-app browser, or on a
 * suppressed route. Where the browser offers a native prompt the button uses
 * it; otherwise (iOS, or a signed-out visitor with a referral — who must sign
 * up on /install first) it opens /install.
 */
export default function InstallPrompt() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading } = useUser() || {};
  const { ready, platform, installed, inAppBrowser, canPromptInstall, promptInstall } = usePwa();
  const [visible, setVisible] = useState(false);
  const [eligibleVisit, setEligibleVisit] = useState(false);

  // Count one visit per browser session.
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("trybe_pwa_visit_counted")) {
        sessionStorage.setItem("trybe_pwa_visit_counted", "1");
        safeSet(STORAGE_KEYS.visits, Number(safeGet(STORAGE_KEYS.visits) || 0) + 1);
      }
    } catch {
      // no sessionStorage — can't count visits, so never show
      return;
    }
    setEligibleVisit(Number(safeGet(STORAGE_KEYS.visits) || 0) >= PROMPT_MIN_VISITS);
  }, []);

  const blocked =
    !ready ||
    loading ||
    installed ||
    inAppBrowser ||
    platform === "desktop" ||
    !eligibleVisit ||
    isSuppressed(pathname || "/");

  useEffect(() => {
    if (blocked) {
      setVisible(false);
      return;
    }
    if (Number(safeGet(STORAGE_KEYS.promptSnoozedUntil) || 0) > Date.now()) return;
    const timer = setTimeout(() => {
      setVisible(true);
      trackEvent(EVENT_TYPES.PWA_PROMPT_SHOWN, null, "pwa", { platform });
    }, PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [blocked, platform]);

  const snooze = () => safeSet(STORAGE_KEYS.promptSnoozedUntil, Date.now() + PROMPT_SNOOZE_MS);

  const dismiss = () => {
    snooze();
    setVisible(false);
    trackEvent(EVENT_TYPES.PWA_PROMPT_DISMISSED, null, "pwa", { platform });
  };

  const install = async () => {
    // A signed-out visitor with a referral must sign up first (see /install).
    const mustSignUpFirst = !currentUser && !!getArrivalRef(null);
    if (canPromptInstall && !mustSignUpFirst) {
      const outcome = await promptInstall();
      if (outcome === "accepted") trackEvent(EVENT_TYPES.PWA_PROMPT_ACCEPTED, null, "pwa", { platform });
      else if (outcome === "dismissed") trackEvent(EVENT_TYPES.PWA_PROMPT_DISMISSED, null, "pwa", { platform });
      snooze();
      setVisible(false);
      return;
    }
    snooze();
    setVisible(false);
    router.push("/install");
  };

  if (!visible) return null;

  // Detail pages have their own sticky action bar along the bottom; sit above it.
  const hasStickyBar = /^\/(listing|view-service)\//.test(pathname || "");

  return (
    <div
      role="dialog"
      aria-label="Install TrybeMarket"
      className={`fixed inset-x-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300 ${
        hasStickyBar ? "bottom-[4.5rem]" : "bottom-0"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">Get the TrybeMarket app</p>
          <p className="text-xs text-gray-500">Faster, full screen, one tap from your home screen.</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          {canPromptInstall && (currentUser || !getArrivalRef(null)) ? "Install" : "How"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
