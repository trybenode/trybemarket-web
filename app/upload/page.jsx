"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { Briefcase, ChevronRight, IdCard, Package } from "lucide-react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { isKycCleared } from "@/lib/kycAccess";
import { getUserLimits } from "@/lib/subscriptionStore";

/**
 * "What are you listing?" — the choice between a product and a service, in
 * the /kyc start screen's pattern. Kept deliberately quiet: two cards, plus a
 * notice only when something stops the seller (not verified yet, or the
 * plan's listing limit is used up).
 */

const OPTIONS = [
  {
    type: "product",
    title: "A product",
    subtitle: "Clothes, gadgets, food, books…",
    Icon: Package,
    tone: "bg-blue-50 text-primary",
    route: "/product-upload",
    collection: "products",
    limitKey: "maxProducts",
  },
  {
    type: "service",
    title: "A service",
    subtitle: "Hair, tutoring, design, repairs…",
    Icon: Briefcase,
    tone: "bg-brand-yellow text-slate-900",
    route: "/service-upload",
    collection: "services",
    limitKey: "maxServices",
    badge: "Beta",
  },
];

/** Which listing types have used up the plan's limit — empty until loaded (or signed out). */
function useFullTypes(userId) {
  const [full, setFull] = useState([]);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [limits, ...counts] = await Promise.all([
          getUserLimits(userId),
          ...OPTIONS.map((o) => getCountFromServer(query(collection(db, o.collection), where("userId", "==", userId)))),
        ]);
        if (!cancelled) {
          setFull(OPTIONS.filter((o, i) => counts[i].data().count >= (limits?.[o.limitKey] ?? Infinity)).map((o) => o.type));
        }
      } catch (error) {
        console.error("Couldn't check listing limits:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return full;
}

export default function Upload() {
  const { currentUser } = useUser();
  const fullTypes = useFullTypes(currentUser?.uid);
  const needsKyc = !!currentUser && !isKycCleared(currentUser);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Start selling" />

      <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">What are you listing?</h1>
          <p className="mt-0.5 text-sm text-slate-500">You can edit it any time.</p>
        </div>

        {needsKyc && (
          <Link href="/kyc" className="flex items-center gap-2.5 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 transition active:scale-[0.99]">
            <IdCard className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1 text-sm text-slate-800">
              <span className="font-semibold">Verify you're a student first.</span> It takes a minute.
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        )}

        <div className="space-y-2.5">
          {OPTIONS.map(({ type, title, subtitle, Icon, tone, route, badge }) => {
            const full = fullTypes.includes(type);
            return (
              <Link
                key={type}
                href={full ? "/subscription" : route}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    {title}
                    {badge && (
                      <Badge variant="brand" className="px-1.5 py-0 text-[10px]">
                        {badge}
                      </Badge>
                    )}
                  </span>
                  <span className={`block text-xs ${full ? "text-red-600" : "text-slate-500"}`}>
                    {full ? "Your plan's limit is reached. Upgrade to list more." : subtitle}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            );
          })}
        </div>

        <p className="pt-2 text-center text-xs text-slate-500">
          Already listed something?{" "}
          <Link href="/my-shop" className="font-medium text-primary">
            Go to My Shop
          </Link>
        </p>
      </div>
    </div>
  );
}
