"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, MailX } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

/**
 * Landing page for the unsubscribe link in TrybeMarket's promotional emails
 * (08-campaign-messaging.md §7.1). Works without signing in — the link's
 * signed token is the authorisation. Nothing changes until the person clicks
 * the button: email security scanners open links automatically, and an
 * unsubscribe on page load would let them opt people out by accident.
 * (Gmail's one-click unsubscribe POSTs to /api/unsubscribe directly.)
 */
function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("u");
  const token = searchParams.get("t");

  // "idle" | "working" | "unsubscribed" | "resubscribed"
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  const submit = async (action) => {
    setState("working");
    setError("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u: uid, t: token, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setState(data.optedOut ? "unsubscribed" : "resubscribed");
    } catch (err) {
      setError(err.message);
      setState(action === "resubscribe" ? "unsubscribed" : "idle");
    }
  };

  if (!uid || !token) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-slate-900">This link is incomplete</p>
        <p className="text-sm text-slate-600">
          Please use the unsubscribe link at the bottom of one of our emails, or turn off
          &ldquo;Offers &amp; updates&rdquo; in your profile settings.
        </p>
        <Button asChild variant="outline">
          <Link href="/edit-profile">Go to profile settings</Link>
        </Button>
      </div>
    );
  }

  if (state === "unsubscribed") {
    return (
      <div className="space-y-4 text-center">
        <MailX className="mx-auto h-10 w-10 text-slate-500" />
        <p className="text-lg font-semibold text-slate-900">You&rsquo;re unsubscribed</p>
        <p className="text-sm text-slate-600">
          You won&rsquo;t get promotional emails from TrybeMarket anymore. We&rsquo;ll still email you
          about your account, like verification results.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button variant="outline" onClick={() => submit("resubscribe")}>
          Undo — keep getting offers
        </Button>
      </div>
    );
  }

  if (state === "resubscribed") {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-green-600" />
        <p className="text-lg font-semibold text-slate-900">You&rsquo;re subscribed again</p>
        <p className="text-sm text-slate-600">You&rsquo;ll keep getting offers and updates from TrybeMarket by email.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-lg font-semibold text-slate-900">Unsubscribe from TrybeMarket offers?</p>
      <p className="text-sm text-slate-600">
        You&rsquo;ll stop getting promotional emails like campus deals and updates. Emails about your
        account, like verification results, will still arrive.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={() => submit("unsubscribe")} disabled={state === "working"}>
        {state === "working" ? "Unsubscribing…" : "Unsubscribe"}
      </Button>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header title="Email preferences" />
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <Suspense fallback={null}>
            <UnsubscribeContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
