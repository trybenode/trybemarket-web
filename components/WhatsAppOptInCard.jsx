"use client";

import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { MessageSquare, X } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { useUser } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validatePhone, convertToInternationalFormat, toDisplayPhone } from "@/lib/phone";

const DISMISS_KEY = "trybemarket:whatsappOptInDismissedAt";
const DISMISS_DAYS = 30;

function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Asks a signed-in user to get offers and campus updates on WhatsApp
 * (08-campaign-messaging.md §7.3). This is the explicit consent Meta requires
 * for marketing messages, and it's separate from WhatsApp message alerts
 * (`whatsappNotifications`). Campaigns only go to `whatsappMarketing: true`.
 *
 * Hidden for anyone already opted in, anyone who has opted out before (no
 * nagging), and for 30 days after "Not now".
 *
 * `source` records where consent was given, e.g. "my_shop" or "home".
 * `className` is applied only when the card shows (e.g. spacing).
 */
export default function WhatsAppOptInCard({ source, className = "" }) {
  const { currentUser, setCurrentUser } = useUser() || {};
  const [dismissed, setDismissed] = useState(true); // decided after mount (localStorage)
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saving, setSaving] = useState(false);

  const uid = currentUser?.uid || currentUser?.id;

  useEffect(() => {
    setDismissed(wasDismissedRecently());
  }, []);

  useEffect(() => {
    setPhone(toDisplayPhone(currentUser?.phone));
  }, [currentUser?.phone]);

  if (!uid || dismissed) return null;
  if (currentUser.whatsappMarketing === true || currentUser.whatsappMarketingOptOutAt) return null;

  const handleNotNow = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage unavailable (private mode) — just hide for this visit.
    }
    setDismissed(true);
  };

  const handleOptIn = async (e) => {
    e.preventDefault();
    const error = phone ? validatePhone(phone) : "Enter your WhatsApp number";
    setPhoneError(error);
    if (error) return;

    setSaving(true);
    try {
      const update = {
        phone: convertToInternationalFormat(phone),
        whatsappMarketing: true,
        whatsappMarketingAt: new Date().toISOString(),
        whatsappMarketingSource: source || "prompt",
      };
      await updateDoc(doc(db, "users", uid), update);
      setCurrentUser?.((prev) => (prev ? { ...prev, ...update } : prev));
      toast.success("You're in! We'll send offers and campus updates on WhatsApp.");
    } catch (err) {
      console.error("WhatsApp opt-in failed:", err);
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`relative rounded-3xl border border-green-200 bg-green-50/60 p-4 shadow-sm sm:p-5 ${className}`}>
      <button
        type="button"
        onClick={handleNotNow}
        aria-label="Not now"
        className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-semibold text-slate-900">Get campus deals on WhatsApp</p>
            <p className="text-sm text-slate-600">
              Get offers, new features and campus updates from TrybeMarket on WhatsApp. Stop
              anytime: tap &ldquo;Stop promotions&rdquo; in any message, or turn it off in your profile.
            </p>
          </div>
          <form onSubmit={handleOptIn} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="WhatsApp number, e.g. 08012345678"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError("");
                }}
                className={phoneError ? "border-red-500 bg-white" : "bg-white"}
                disabled={saving}
                aria-label="WhatsApp number"
              />
              {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
            </div>
            <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? "Saving…" : "Yes, send me offers"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
