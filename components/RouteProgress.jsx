"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePwa } from "@/context/PwaContext";

/**
 * Thin top progress bar for page navigations, shown only in the installed app.
 * A browser tab has its own loading indicator; an installed app has none, so
 * a tap on a link looks like nothing happened until the next page appears.
 *
 * Starts on a same-page-origin link click (the App Router gives no "navigation
 * started" event), trickles toward 90%, and completes when the route actually
 * changes. A 10s cap hides it if a navigation never lands. Programmatic
 * router.push() calls (e.g. after login) don't start it — buttons that trigger
 * those already show their own loading state — but they still finish it.
 */
export default function RouteProgress() {
  const { isStandalone } = usePwa();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef(null);
  const cap = useRef(null);
  const hide = useRef(null);
  const active = useRef(false);

  const clearTimers = () => {
    clearInterval(trickle.current);
    clearTimeout(cap.current);
    clearTimeout(hide.current);
  };

  const finish = () => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setProgress(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  useEffect(() => {
    if (!isStandalone) return;

    const start = () => {
      if (active.current) return;
      active.current = true;
      clearTimers();
      setVisible(true);
      setProgress(8);
      trickle.current = setInterval(() => setProgress((p) => p + (90 - p) * 0.12), 200);
      cap.current = setTimeout(finish, 10000);
    };

    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
    // finish/clearTimers only touch refs and state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone]);

  // The route changed: the navigation landed.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!isStandalone || !visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
        style={{ width: `${progress}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}
