"use client";

import Link from "next/link";
import toast from "react-hot-toast";
import { Copy, GraduationCap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrsaMembership } from "@/hooks/useCrsaMembership";
import { buildReferralLink } from "@/lib/crsaConstants";

/**
 * The ambassador's own referral link and stats (04-crsa-affiliate-program.md
 * §5: shown on their normal profile, no separate dashboard). Renders nothing
 * for anyone who isn't an ACTIVE CRSA member. These are only numbers for
 * recognition and manual gifting — no App Credit is earned through CRSA.
 */
export default function CrsaStatsCard({ userId }) {
  const { member, stats, loading } = useCrsaMembership(userId);

  if (loading) return <Skeleton className="h-36 w-full rounded-xl mb-6" />;
  if (!member?.active) return null;

  // The link must point at the site this ambassador is actually using — see buildReferralLink.
  const link = buildReferralLink(member.referralCode, window.location.origin);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Referral link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  return (
    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 sm:p-6 mb-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-3">
        <GraduationCap className="h-4 w-4" /> Campus Ambassador
      </div>

      <div className="flex items-center gap-6 mb-4">
        <div>
          <div className="text-2xl font-bold text-gray-900">{stats?.kycCompletions ?? 0}</div>
          <div className="text-xs text-gray-600">Verified referrals</div>
        </div>
        <div className="h-8 w-px bg-emerald-200" />
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {stats?.installs ?? 0}
            <span className="text-base font-medium text-gray-500"> of {stats?.kycCompletions ?? 0}</span>
          </div>
          <div className="text-xs text-gray-600">Verified referrals with the app</div>
        </div>
      </div>

      <label className="text-xs text-gray-600 block mb-1">Your referral link</label>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 text-sm rounded-md border border-emerald-200 bg-white px-3 py-2 text-gray-800"
        />
        <Button type="button" variant="outline" onClick={copy}>
          <Copy className="h-4 w-4 mr-1" /> Copy
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        A referral counts once the person you invite completes KYC verification.
      </p>
      <p className="text-xs text-gray-500 mt-1">
        App installs are counted only for verified referrals, so this number can never be higher than your verified
        referrals — a smaller number here is normal.
      </p>

      <Link
        href="/crsa-leaderboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800 mt-3"
      >
        <Trophy className="h-4 w-4" /> View the leaderboard
      </Link>
    </div>
  );
}
