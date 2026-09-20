"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  detectPlatform,
  isInAppBrowser,
  isStandalone,
  markInstalledLocally,
  wasInstalledLocally,
} from "@/lib/pwa";

const PwaContext = createContext(null);

/**
 * Install state for the whole app. Mounted once in the root layout because
 * `beforeinstallprompt` can fire before any page component has mounted — if
 * only /install listened, the event (which fires once) would usually be lost.
 * An inline script in the layout stashes an early event on
 * window.__trybeInstallPrompt; this provider adopts it on mount.
 *
 * iOS never fires beforeinstallprompt or appinstalled, so "installed" there is
 * only ever observable as "we are now running standalone" — which is why
 * `installSource` reports how we know, and the server-side tracker keys off it.
 */
export function PwaProvider({ children }) {
  const deferredPrompt = useRef(null);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installedLocally, setInstalledLocally] = useState(false);
  const [appInstalledEvent, setAppInstalledEvent] = useState(false);
  const [platform, setPlatform] = useState("desktop");
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInAppBrowser(isInAppBrowser());
    setStandalone(isStandalone());
    setInstalledLocally(wasInstalledLocally());
    setReady(true);

    if (window.__trybeInstallPrompt) {
      deferredPrompt.current = window.__trybeInstallPrompt;
      setCanPromptInstall(true);
    }

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault(); // keep it for our own button instead of Chrome's mini-infobar
      deferredPrompt.current = event;
      window.__trybeInstallPrompt = event;
      setCanPromptInstall(true);
    };
    const onAppInstalled = () => {
      deferredPrompt.current = null;
      window.__trybeInstallPrompt = null;
      markInstalledLocally();
      setCanPromptInstall(false);
      setInstalledLocally(true);
      setAppInstalledEvent(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayModeChange = () => setStandalone(isStandalone());
    mq?.addEventListener?.("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mq?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  // Running standalone is itself proof of an install on this device.
  useEffect(() => {
    if (standalone) {
      markInstalledLocally();
      setInstalledLocally(true);
    }
  }, [standalone]);

  /** Shows the native install dialog. Returns "accepted" | "dismissed" | "unavailable". */
  const promptInstall = useCallback(async () => {
    const event = deferredPrompt.current;
    if (!event) return "unavailable";
    try {
      event.prompt();
      const { outcome } = await event.userChoice;
      // A prompt event can be used once, accepted or not.
      deferredPrompt.current = null;
      window.__trybeInstallPrompt = null;
      setCanPromptInstall(false);
      return outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      return "unavailable";
    }
  }, []);

  const installSource = appInstalledEvent ? "appinstalled" : standalone ? "standalone" : null;

  const value = {
    ready,
    platform,
    inAppBrowser,
    isStandalone: standalone,
    installed: standalone || installedLocally,
    canPromptInstall,
    installSource,
    promptInstall,
  };

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

const FALLBACK = {
  ready: false,
  platform: "desktop",
  inAppBrowser: false,
  isStandalone: false,
  installed: false,
  canPromptInstall: false,
  installSource: null,
  promptInstall: async () => "unavailable",
};

export const usePwa = () => useContext(PwaContext) || FALLBACK;
