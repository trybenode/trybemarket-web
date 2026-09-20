"use client";

import { useEffect } from "react";
import { PWA_ENABLED, registerServiceWorker, unregisterServiceWorkers } from "@/lib/pwa";

/**
 * Registers the service worker (production builds only) — or, when
 * NEXT_PUBLIC_PWA_ENABLED=false, removes it. Renders nothing.
 */
export default function PwaBootstrap() {
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

  return null;
}
