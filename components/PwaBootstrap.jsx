"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PWA_ENABLED,
  consumePostSignupInstallFlag,
  hasPostSignupInstallFlag,
  registerServiceWorker,
  unregisterServiceWorkers,
} from "@/lib/pwa";
import { reportInstall } from "@/lib/pwaClient";
import { useUser } from "@/context/UserContext";
import { usePwa } from "@/context/PwaContext";
import { trackEvent, EVENT_TYPES } from "@/utils/analytics";

/**
 * Mounted once inside the providers. Renders nothing. It:
 *  1. registers the service worker (production only) — or, when
 *     NEXT_PUBLIC_PWA_ENABLED=false, removes it;
 *  2. tracks installs: once a signed-in user is running the installed app
 *     (or an `appinstalled` event fired), reports it to the server. iOS has no
 *     install event, so "first standalone launch while signed in" is the one
 *     signal that works everywhere. A user who signs up *inside* the installed
 *     app is reported the moment they sign in;
 *  3. brings someone back to /install once after they sign up from its gate
 *     (the gate sets a flag; we act on it when they reach the home page, so
 *     it never fights the signup page's own redirect or onboarding).
 */
export default function PwaBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, loading } = useUser() || {};
  const { platform, isStandalone, installSource } = usePwa();
  const reported = useRef(new Set());

  useEffect(() => {
    if (!PWA_ENABLED) {
      unregisterServiceWorkers();
      return;
    }
    // Wait for load so registration never competes with the page's own resources.
    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }
    const onLoad = () => registerServiceWorker();
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid || !installSource) return;
    if (reported.current.has(uid)) return;
    reported.current.add(uid);
    reportInstall({ platform, source: installSource }).then((ok) => {
      if (ok) trackEvent(EVENT_TYPES.PWA_INSTALLED, null, "pwa", { platform, source: installSource });
      else reported.current.delete(uid);
    });
  }, [currentUser?.id, installSource, platform]);

  useEffect(() => {
    if (loading || !currentUser || isStandalone || pathname !== "/") return;
    if (hasPostSignupInstallFlag() && consumePostSignupInstallFlag()) {
      router.replace("/install");
    }
  }, [loading, currentUser, isStandalone, pathname, router]);

  return null;
}
