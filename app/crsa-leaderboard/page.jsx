"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/context/UserContext";
import { useCrsaLeaderboard } from "@/hooks/useCrsaLeaderboard";

/**
 * CRSA leaderboard — visible to admins and ACTIVE CRSA members (the API
 * returns 403 to anyone else, shown here as a friendly notice). Ranked by
 * verified referrals, then app installs. Numbers only: this is recognition and
 * input for manual gifting, not an App Credit reward.
 */
export default function CrsaLeaderboardPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser();
  const { leaderboard, loading, forbidden, error } = useCrsaLeaderboard(currentUser?.uid);

  useEffect(() => {
    if (!authLoading && !currentUser) router.push("/login");
  }, [currentUser, authLoading, router]);

  const medal = (rank) =>
    rank === 1 ? "bg-brand-yellow text-slate-900" : rank === 2 ? "bg-slate-200 text-slate-800" : rank === 3 ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Ambassador leaderboard" />

      <div className="mx-auto max-w-3xl px-4 py-5">
        {authLoading || loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : forbidden ? (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Ambassadors only</h3>
            <p className="mt-1 text-sm text-slate-500">The leaderboard is visible to Campus Ambassadors.</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : leaderboard.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No ambassadors on the board yet.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 sm:px-6">
              <Trophy className="h-4 w-4 text-amber-500" /> Ranked by verified referrals
            </div>
            <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:px-6">
              App installs are counted only for verified referrals, so each ambassador's installs are always at most
              their verified count — a lower installs number is expected, not an error.
            </p>
            {leaderboard.map((row, i) => (
              <div
                key={row.uid || `${row.rank}-${i}`}
                className={cn(
                  "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:gap-4 sm:px-6",
                  row.isYou && "bg-blue-50/60"
                )}
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums", medal(row.rank))}>
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.fullName}
                    {row.isYou && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">You</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.installs} of {row.kycCompletions} verified {row.installs === 1 ? "has" : "have"} the app
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold tabular-nums text-slate-900">{row.kycCompletions}</p>
                  <p className="text-xs text-slate-500">verified</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
