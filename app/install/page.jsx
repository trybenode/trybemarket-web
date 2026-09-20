"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Lock,
  MoreVertical,
  Plus,
  Share,
  Monitor,
  Smartphone,
} from "lucide-react";
import { usePwa } from "@/context/PwaContext";
import { useUser } from "@/context/UserContext";
import { setPostSignupInstallFlag } from "@/lib/pwa";
import { getArrivalRef } from "@/lib/installGate";
import { trackEvent, EVENT_TYPES } from "@/utils/analytics";

/**
 * /install — public. Animated, per-platform instructions plus an Install
 * button where the browser supports a native prompt.
 *
 * ATTRIBUTION GATE: a signed-out visitor who arrived with a referral code is
 * asked to create their account BEFORE seeing the install steps. An installed
 * iOS app has storage separate from Safari, so a code captured here would not
 * be visible inside it; if they installed first and signed up afterwards, the
 * referral would silently vanish. Signing up here, in the browser, writes the
 * referral onto their account first. Visitors with no referral, and everyone
 * already signed in, see the full page immediately. Auth itself is untouched —
 * the buttons just link to the existing /signup and /login pages.
 */

const CSS = `
@keyframes inst-ripple{0%{transform:scale(.5);opacity:.6}70%{transform:scale(1.7);opacity:0}100%{transform:scale(1.7);opacity:0}}
@keyframes inst-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes inst-slide{0%,10%{transform:translateY(105%)}30%,88%{transform:translateY(0)}100%{transform:translateY(105%)}}
@keyframes inst-pulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.5)}50%{box-shadow:0 0 0 7px rgba(37,99,235,0)}}
@keyframes inst-pop{0%,25%{transform:scale(0);opacity:0}50%{transform:scale(1.18);opacity:1}65%,92%{transform:scale(1);opacity:1}100%{transform:scale(0);opacity:0}}
@keyframes inst-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes inst-glow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.08)}}
.inst-rise{animation:inst-rise .5s ease-out both}
.inst-ripple{animation:inst-ripple 1.8s ease-out infinite}
.inst-float{animation:inst-float 3.4s ease-in-out infinite}
.inst-slide{animation:inst-slide 5s ease-in-out infinite}
.inst-pulse{animation:inst-pulse 1.8s ease-in-out infinite}
.inst-pop{animation:inst-pop 4s ease-in-out infinite}
.inst-glow{animation:inst-glow 3.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.inst-rise,.inst-ripple,.inst-float,.inst-slide,.inst-pulse,.inst-pop,.inst-glow{animation:none!important}.inst-slide{transform:none}.inst-pop{transform:none;opacity:1}.inst-ripple{opacity:.35;transform:scale(1.2)}}
`;

const TABS = [
  { key: "ios", label: "iPhone / iPad", Icon: Smartphone },
  { key: "android", label: "Android", Icon: Smartphone },
  { key: "desktop", label: "Computer", Icon: Monitor },
];

/* ---------- little illustrations ---------- */

function Tap({ className = "" }) {
  return <span aria-hidden className={`inst-ripple pointer-events-none absolute inset-0 rounded-full bg-blue-500/50 ${className}`} />;
}

function Frame({ children, className = "" }) {
  return (
    <div
      aria-hidden
      className={`relative h-36 w-28 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-inner ${className}`}
    >
      {children}
    </div>
  );
}

const Line = ({ w = "w-full" }) => <div className={`h-1.5 rounded bg-gray-200 ${w}`} />;

function AppIcon({ className = "h-9 w-9" }) {
  return <img src="/icons/icon-192.png" alt="" className={`rounded-xl ${className}`} />;
}

const ILLUSTRATIONS = {
  "ios-1": (
    <Frame>
      <div className="space-y-2 p-3 pt-4"><Line /><Line w="w-2/3" /><Line w="w-5/6" /></div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-gray-200 bg-white/90 px-2 py-2">
        <div className="h-3 w-3 rounded-sm bg-gray-300" />
        <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
          <Tap />
          <Share className="relative h-4 w-4 text-blue-600" />
        </div>
        <div className="h-3 w-3 rounded-sm bg-gray-300" />
      </div>
    </Frame>
  ),
  "ios-2": (
    <Frame>
      <div className="inst-slide absolute inset-x-1 bottom-1 space-y-1.5 rounded-xl bg-white p-2 shadow-lg">
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-gray-200" /><Line /></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-gray-200" /><Line w="w-4/5" /></div>
        <div className="inst-pulse flex items-center gap-1.5 rounded-md bg-blue-50 p-1 ring-1 ring-blue-300">
          <Plus className="h-3.5 w-3.5 rounded-sm border border-blue-500 text-blue-600" />
          <span className="text-[8px] font-semibold leading-none text-blue-700">Add to Home Screen</span>
        </div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-gray-200" /><Line w="w-3/5" /></div>
      </div>
    </Frame>
  ),
  "ios-3": (
    <Frame className="bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5 text-[8px]">
        <span className="text-gray-400">Cancel</span>
        <span className="relative rounded-full px-1.5 py-0.5 font-semibold text-blue-600">
          <Tap className="rounded-full" />
          <span className="relative">Add</span>
        </span>
      </div>
      <div className="flex flex-col items-center gap-1.5 p-3">
        <AppIcon className="h-10 w-10 shadow" />
        <span className="text-[9px] font-semibold text-gray-800">TrybeMarket</span>
        <Line w="w-16" />
      </div>
    </Frame>
  ),
  "android-1": (
    <Frame>
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5">
        <div className="h-3 flex-1 rounded-full bg-gray-100" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full">
          <Tap />
          <MoreVertical className="relative h-4 w-4 text-gray-700" />
        </div>
      </div>
      <div className="space-y-2 p-3"><Line /><Line w="w-2/3" /><Line w="w-5/6" /></div>
    </Frame>
  ),
  "android-2": (
    <Frame>
      <div className="inst-pop absolute right-1 top-1 w-24 space-y-1.5 rounded-lg bg-white p-2 shadow-lg" style={{ transformOrigin: "top right" }}>
        <Line w="w-3/4" />
        <div className="inst-pulse rounded-md bg-blue-50 p-1 ring-1 ring-blue-300">
          <span className="text-[8px] font-semibold leading-none text-blue-700">Install app</span>
        </div>
        <Line w="w-2/3" />
        <Line w="w-4/5" />
      </div>
    </Frame>
  ),
  "android-3": (
    <Frame className="bg-white">
      <div className="mx-2 mt-8 space-y-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
        <div className="flex items-center gap-1.5">
          <AppIcon className="h-6 w-6" />
          <span className="text-[9px] font-semibold text-gray-800">Install app?</span>
        </div>
        <div className="flex justify-end gap-2 text-[8px]">
          <span className="text-gray-400">Cancel</span>
          <span className="relative rounded px-1.5 font-semibold text-blue-600">
            <Tap className="rounded" />
            <span className="relative">Install</span>
          </span>
        </div>
      </div>
    </Frame>
  ),
  "desktop-1": (
    <Frame className="w-40">
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5">
        <div className="flex h-4 flex-1 items-center justify-end rounded-full bg-gray-100 px-1">
          <span className="relative flex h-3.5 w-3.5 items-center justify-center rounded">
            <Tap className="rounded" />
            <Download className="relative h-3 w-3 text-blue-600" />
          </span>
        </div>
      </div>
      <div className="space-y-2 p-3"><Line /><Line w="w-2/3" /><Line w="w-5/6" /></div>
    </Frame>
  ),
  "desktop-2": (
    <Frame className="w-40 bg-white">
      <div className="mx-auto mt-6 w-28 space-y-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
        <div className="flex items-center gap-1.5">
          <AppIcon className="h-6 w-6" />
          <span className="text-[9px] font-semibold text-gray-800">Install TrybeMarket?</span>
        </div>
        <div className="flex justify-end">
          <span className="relative rounded px-2 py-0.5 text-[8px] font-semibold text-white bg-blue-600">
            <span className="inst-pulse absolute inset-0 rounded" />
            <span className="relative">Install</span>
          </span>
        </div>
      </div>
    </Frame>
  ),
};

const STEPS = {
  ios: [
    { title: "Tap the Share button", body: "It's the square with an arrow at the bottom of Safari (top right on iPad).", art: "ios-1" },
    { title: "Choose “Add to Home Screen”", body: "Scroll down in the share sheet if you don't see it right away.", art: "ios-2" },
    { title: "Tap “Add”", body: "TrybeMarket lands on your home screen like any other app.", art: "ios-3" },
  ],
  android: [
    { title: "Open the browser menu", body: "Tap the three dots ⋮ at the top right of Chrome.", art: "android-1" },
    { title: "Tap “Install app”", body: "Some phones say “Add to Home screen” instead — same thing.", art: "android-2" },
    { title: "Confirm", body: "Tap Install. TrybeMarket appears in your app drawer and home screen.", art: "android-3" },
  ],
  desktop: [
    { title: "Find the install icon", body: "In Chrome or Edge, look at the right end of the address bar for the install icon.", art: "desktop-1" },
    { title: "Click “Install”", body: "TrybeMarket opens in its own window and gets a shortcut.", art: "desktop-2" },
  ],
};

function StepList({ steps }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li
          key={step.art}
          className="inst-rise flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          {ILLUSTRATIONS[step.art]}
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
              <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- page ---------- */

function InstallInner() {
  const searchParams = useSearchParams();
  const urlRef = searchParams.get("ref");
  const { currentUser, loading } = useUser() || {};
  const { ready, platform, inAppBrowser, installed, isStandalone, canPromptInstall, promptInstall } = usePwa();

  const [tab, setTab] = useState(null);
  const [arrivalRef, setArrivalRef] = useState(null);
  const [outcome, setOutcome] = useState(null); // "accepted" | "dismissed" | null
  const [copied, setCopied] = useState(false);

  useEffect(() => setArrivalRef(getArrivalRef(urlRef)), [urlRef]);
  useEffect(() => {
    if (ready && !tab) setTab(platform);
  }, [ready, platform, tab]);

  const activeTab = tab || "ios";
  const gated = !loading && !currentUser && !!arrivalRef;
  const authLoading = loading || !ready;
  const isInstalledNow = installed || outcome === "accepted";
  const canInstallHere = canPromptInstall && activeTab === platform && !inAppBrowser;

  const signupHref = arrivalRef ? `/signup?ref=${arrivalRef}` : "/signup";

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result === "accepted") trackEvent(EVENT_TYPES.PWA_PROMPT_ACCEPTED, null, "pwa", { platform, from: "install_page" });
    else if (result === "dismissed") trackEvent(EVENT_TYPES.PWA_PROMPT_DISMISSED, null, "pwa", { platform, from: "install_page" });
    if (result !== "unavailable") setOutcome(result);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the user can still copy from the address bar
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white">
      <style>{CSS}</style>

      <div className="mx-auto max-w-lg px-4 pb-16 pt-5">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-blue-700 hover:underline">← Back to TrybeMarket</Link>
        </div>

        {/* hero */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-5 h-24 w-24">
            <span className="inst-glow absolute -inset-4 rounded-full bg-blue-300/40 blur-xl" aria-hidden />
            <img src="/icons/icon-512.png" alt="TrybeMarket" className="inst-float relative h-24 w-24 rounded-3xl bg-white shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Get TrybeMarket on your home screen</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600">
            Open it in one tap, full screen, without the browser bars. Free — no app store needed.
          </p>
        </div>

        {authLoading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
          </div>
        ) : isInstalledNow ? (
          <div className="inst-rise rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
            <h2 className="text-base font-semibold text-green-900">
              {isStandalone ? "You're using the app" : "TrybeMarket is installed"}
            </h2>
            <p className="mt-1 text-sm text-green-800">
              {isStandalone ? "You're all set." : "Open it from your home screen or app list anytime."}
            </p>
          </div>
        ) : gated ? (
          <div className="space-y-4">
            <div className="inst-rise rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">Step 1 of 2</p>
              <h2 className="text-lg font-bold text-gray-900">Create your free account</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                A TrybeMarket ambassador invited you. Creating your account first makes sure they get credit for it —
                then you'll come straight back here to install.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={signupHref}
                  onClick={setPostSignupInstallFlag}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  onClick={setPostSignupInstallFlag}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  I already have one
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-gray-400">
              <Lock className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide">Step 2 of 2</p>
                <p className="text-sm">Install the app — unlocks once you're signed in.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {inAppBrowser && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ExternalLink className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <h2 className="text-sm font-semibold text-amber-900">Open this page in your browser first</h2>
                    <p className="mt-1 text-sm text-amber-800">
                      You're inside another app, which can't install TrybeMarket. Tap the ⋯ or share menu and choose
                      “Open in {platform === "ios" ? "Safari" : "Chrome"}”, or copy the link.
                    </p>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Link copied" : "Copy link"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* platform switcher */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Choose your device">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                    activeTab === key ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* one-tap install where the browser supports it */}
            {canInstallHere && (
              <div className="inst-rise text-center">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="inst-pulse inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-blue-700"
                >
                  <Download className="h-5 w-5" />
                  Install TrybeMarket
                </button>
                {outcome === "dismissed" && (
                  <p className="mt-2 text-xs text-gray-500">No problem — you can install any time from here, or follow the steps below.</p>
                )}
                <p className="mb-1 mt-4 text-xs text-gray-400">Or do it by hand:</p>
              </div>
            )}

            {activeTab === "ios" && platform === "ios" && !inAppBrowser && (
              <p className="rounded-xl bg-blue-50 px-4 py-3 text-center text-sm text-blue-900">
                iPhone and iPad don't have an install button — it takes three quick taps in Safari.
              </p>
            )}
            {activeTab !== platform && (
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
                These steps are for a different device than the one you're on.
              </p>
            )}

            <StepList steps={STEPS[activeTab]} />

            <p className="text-center text-xs text-gray-400">
              Already have the Android app from Google Play? You can keep using that — this is the same TrybeMarket in your browser.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InstallPage() {
  return (
    <Suspense fallback={null}>
      <InstallInner />
    </Suspense>
  );
}
