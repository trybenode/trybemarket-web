"use client";

import Link from "next/link";
import toast from "react-hot-toast";
import { Check, Copy, GraduationCap, Share2, Trophy, Users, Smartphone } from "lucide-react";
import { useState } from "react";
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
  const [copied, setCopied] = useState(false);

  if (loading) return <Skeleton className="h-64 w-full rounded-3xl" />;
  if (!member?.active) return null;

  // The link must point at the site this ambassador is actually using — see buildReferralLink.
  const link = buildReferralLink(member.referralCode, window.location.origin);
  const verified = stats?.kycCompletions ?? 0;
  const installs = stats?.installs ?? 0;
  // Installs are only counted for verified referrals, so this is always <= 100%.
  const installPct = verified > 0 ? Math.min(100, Math.round((installs / verified) * 100)) : 0;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Referral link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Join me on TrybeMarket",
        text: "Buy, sell and hire services on campus with TrybeMarket:",
        url: link,
      });
    } catch {
      // dismissed the share sheet — nothing to do
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-brand-yellow-deep/40 bg-gradient-to-br from-brand-yellow-soft via-white to-white p-5 shadow-sm sm:p-6">
      {/* soft decorative glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-yellow/40 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-yellow text-slate-900 shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">Campus Ambassador</h2>
            <p className="text-xs text-slate-500">Invite students, watch your numbers grow</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="xs" className="shrink-0 text-slate-700">
          <Link href="/crsa-leaderboard" aria-label="Open the ambassador leaderboard">
            <Trophy className="text-amber-500" />
            <span className="hidden sm:inline">Leaderboard</span>
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="relative mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Users className="h-3.5 w-3.5" /> Verified referrals
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">{verified}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Smartphone className="h-3.5 w-3.5" /> Installed the app
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
            {installs}
            <span className="ml-1 text-base font-semibold text-slate-400">of {verified}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${installPct}%` }} />
          </div>
        </div>
      </div>

      {/* Link */}
      <div className="relative mt-5">
        <label htmlFor="crsa-link" className="mb-1.5 block text-xs font-semibold text-slate-700">
          Your referral link
        </label>
        <div className="flex gap-2">
          <input
            id="crsa-link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="button" variant={copied ? "soft" : "default"} size="lg" onClick={copy} className="h-11 px-4 text-sm">
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {canShare && (
            <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={share} aria-label="Share your link">
              <Share2 />
            </Button>
          )}
        </div>
      </div>

      <div className="relative mt-4 space-y-1 text-xs leading-relaxed text-slate-500">
        <p>A referral counts once the person you invite completes KYC verification.</p>
        <p>
          App installs are counted only for verified referrals, so this can never be higher than your verified referrals —
          a smaller number here is normal.
        </p>
      </div>
    </section>
  );
}
