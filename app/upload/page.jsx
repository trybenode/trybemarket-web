"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { Briefcase, ChevronRight, IdCard, MessageCircle, Package, Store, Tag, Handshake } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { isKycCleared } from "@/lib/kycAccess";
import { getUserLimits } from "@/lib/subscriptionStore";

/**
 * "What are you listing?" — the choice between a product and a service.
 * Same pattern as the /kyc start screen: a short left-aligned title, then
 * compact cards. Each card says what fits there and what you'll need; when
 * signed in it also shows how many of the plan's slots are used, and a
 * verification notice comes first if the account can't list yet.
 */

const OPTIONS = [
  {
    type: "product",
    title: "A product",
    subtitle: "Something you're selling",
    examples: ["Clothes & shoes", "Gadgets", "Food & drinks", "Beauty", "Books"],
    needs: "Photos, a price and its condition",
    Icon: Package,
    tone: "bg-blue-50 text-primary",
    route: "/product-upload",
    collection: "products",
    limitKey: "maxProducts",
  },
  {
    type: "service",
    title: "A service",
    subtitle: "Something you do for people",
    examples: ["Hair & makeup", "Tutoring", "Design", "Photography", "Laundry"],
    needs: "Photos of your work and a starting price",
    Icon: Briefcase,
    tone: "bg-brand-yellow text-slate-900",
    route: "/service-upload",
    collection: "services",
    limitKey: "maxServices",
    badge: "Beta",
  },
];

const STEPS = [
  { Icon: Tag, title: "List it", text: "Add photos, a price and a short description." },
  { Icon: MessageCircle, title: "Chat with buyers", text: "Buyers message you in the app, and you get an email or WhatsApp alert." },
  { Icon: Handshake, title: "Meet and sell", text: "Meet on campus, then confirm the sale in the chat." },
];

const UNLIMITED = 9999;

/** Listings used and allowed on the seller's plan, per type — null until loaded (or signed out). */
function useListingSlots(userId) {
  const [slots, setSlots] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [limits, ...counts] = await Promise.all([
          getUserLimits(userId),
          ...OPTIONS.map((o) => getCountFromServer(query(collection(db, o.collection), where("userId", "==", userId)))),
        ]);
        if (cancelled) return;
        setSlots(
          Object.fromEntries(OPTIONS.map((o, i) => [o.type, { used: counts[i].data().count, limit: limits?.[o.limitKey] ?? 0 }]))
        );
      } catch (error) {
        console.error("Couldn't load listing slots:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return slots;
}

function SlotLine({ slot, type }) {
  if (!slot) return null;
  if (slot.limit >= UNLIMITED) {
    return <p className="text-[11px] text-slate-500">{slot.used} listed · unlimited on your plan</p>;
  }
  const full = slot.used >= slot.limit;
  const percent = slot.limit > 0 ? Math.min(100, (slot.used / slot.limit) * 100) : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={full ? "font-medium text-red-600" : "text-slate-500"}>
          {full ? `All ${slot.limit} ${type} slots used` : `${slot.used} of ${slot.limit} ${type} slots used`}
        </span>
        {full && <span className="font-semibold text-primary">Upgrade</span>}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${full ? "bg-red-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function Upload() {
  const { currentUser } = useUser();
  const slots = useListingSlots(currentUser?.uid);
  const needsKyc = !!currentUser && !isKycCleared(currentUser);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Start selling" />

      <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">What are you listing?</h1>
          <p className="mt-0.5 text-sm text-slate-500">Takes about two minutes. You can edit it any time.</p>
        </div>

        {needsKyc && (
          <Link
            href="/kyc"
            className="flex items-center gap-2.5 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 transition active:scale-[0.99]"
          >
            <IdCard className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Verify you're a student first</span>
              <span className="block text-xs text-slate-600">Only verified students can list. It takes about a minute.</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        )}

        <div className="space-y-2.5">
          {OPTIONS.map((option) => {
            const slot = slots?.[option.type];
            const full = slot && slot.limit < UNLIMITED && slot.used >= slot.limit;
            const { Icon } = option;
            return (
              <Link
                key={option.type}
                href={full ? "/subscription" : option.route}
                className="block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${option.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {option.title}
                      {option.badge && (
                        <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                          {option.badge}
                        </Badge>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500">{option.subtitle}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {option.examples.map((example) => (
                    <span key={example} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {example}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">You'll need:</span> {option.needs}
                </p>
                {slot && (
                  <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                    <SlotLine slot={slot} type={option.type} />
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">How selling works</h2>
          <ol className="mt-2.5 space-y-3">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-yellow-soft text-amber-700">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">
                    {i + 1}. {title}
                  </span>
                  <span className="block text-xs leading-relaxed text-slate-500">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-center gap-4 pt-1 text-xs font-medium">
          <Link href="/my-shop" className="flex items-center gap-1 text-primary">
            <Store className="h-3.5 w-3.5" /> My Shop
          </Link>
          <span className="h-3 w-px bg-slate-300" />
          <Link href="/subscription" className="text-primary">
            Plans & limits
          </Link>
        </div>
      </div>
    </div>
  );
}
