"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ShieldAlert } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Header title="Ambassador Leaderboard" />

        {authLoading || loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : forbidden ? (
          <div className="flex flex-col items-center py-20 text-center">
            <ShieldAlert className="h-10 w-10 text-gray-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Ambassadors only</h3>
            <p className="text-sm text-gray-600 mt-1">The leaderboard is visible to Campus Ambassadors.</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mt-6">{error}</div>
        ) : leaderboard.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-600">No ambassadors on the board yet.</p>
        ) : (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 text-sm font-medium text-gray-900">
              <Trophy className="h-4 w-4 text-amber-500" /> Ranked by verified referrals
            </div>
            {leaderboard.map((row, i) => (
              <div
                key={row.uid || `${row.rank}-${i}`}
                className={`flex items-center gap-4 px-4 sm:px-6 py-3 border-b border-gray-100 last:border-b-0 ${row.isYou ? "bg-emerald-50" : ""}`}
              >
                <div className="w-8 text-center text-sm font-semibold text-gray-500">{row.rank}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {row.fullName}
                    {row.isYou && <span className="ml-2 text-xs font-normal text-emerald-700">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{row.installs} installs</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{row.kycCompletions}</p>
                  <p className="text-xs text-gray-500">verified</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
