"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Award, Trophy } from "lucide-react";

// Distinct from the existing subscription-tier badge (Crown/Sparkles/Shield,
// computed in ShopPageClient) — these are earned achievement badges from
// 02-badge-system.md, unrelated to paid plan tier.
const BADGE_DISPLAY = {
  verified_student: {
    label: "Verified Student",
    icon: ShieldCheck,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  founding_member: {
    label: "Founding Member",
    icon: Award,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  top_seller: {
    label: "Top Seller",
    icon: Trophy,
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
};

export default function UserBadgesRow({ userId, className = "" }) {
  const [badgeKeys, setBadgeKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    getDocs(collection(db, "users", userId, "badges"))
      .then((snap) => {
        if (cancelled) return;
        // Keyed by the badgeKey FIELD, not the doc ID — a recurring badge
        // like Top Seller has one doc per period (e.g. "top_seller_2026-08")
        // but should only show once here, grouped by achievement type.
        const keys = snap.docs.map((d) => d.data().badgeKey).filter((key) => BADGE_DISPLAY[key]);
        setBadgeKeys([...new Set(keys)]);
      })
      .catch((error) => console.error("Error fetching badges:", error))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading || badgeKeys.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      {badgeKeys.map((key) => {
        const { label, icon: Icon, className: badgeClass } = BADGE_DISPLAY[key];
        return (
          <Badge
            key={key}
            variant="outline"
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${badgeClass}`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
