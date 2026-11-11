"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";

/**
 * "TrybeMarket on WhatsApp" on Profile & Settings: connects the student's
 * WhatsApp number to their account (09-whatsapp-assistant.md §5.1).
 *
 * Connect opens WhatsApp with "LINK <code>" already typed; sending it links
 * the number the message comes from — so there's nothing to type here, and no
 * number is stored on the (publicly readable) profile. Hidden while the
 * assistant is switched off.
 */
async function callLinkApi(method) {
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch("/api/whatsapp/link", { method, headers: { Authorization: `Bearer ${idToken}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

export default function WhatsAppConnectCard() {
  const [status, setStatus] = useState(null); // { available, linked, number }
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false); // sent off to WhatsApp, not confirmed yet

  const refresh = useCallback(async () => {
    try {
      const next = await callLinkApi("GET");
      setStatus(next);
      if (next.linked) setWaiting(false);
    } catch {
      // leave the card as it is; the next refresh may work
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Coming back from WhatsApp: check whether the link went through.
  useEffect(() => {
    if (!waiting) return undefined;
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(refresh, 5000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [waiting, refresh]);

  if (!status?.available && !status?.linked) return null;

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await callLinkApi("POST");
      setWaiting(true);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await callLinkApi("DELETE");
      setStatus((s) => ({ ...s, linked: false, number: null }));
      toast.success("WhatsApp disconnected");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <MessageCircle className="h-4 w-4 text-green-600" /> TrybeMarket on WhatsApp
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">Search TrybeMarket and check your shop by sending us a WhatsApp message.</p>

      {status.linked ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-slate-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate">Connected · {status.number}</span>
          </p>
          <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
        </div>
      ) : (
        <>
          <Button onClick={connect} disabled={busy} className="mt-3 w-full">
            <MessageCircle /> {waiting ? "Open WhatsApp again" : "Connect WhatsApp"}
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {waiting
              ? "Send the message that's typed in for you (it starts with LINK). This page updates once you're connected."
              : "You'll chat with TrybeMarket on WhatsApp. Reply STOP anytime."}
          </p>
        </>
      )}
    </section>
  );
}
