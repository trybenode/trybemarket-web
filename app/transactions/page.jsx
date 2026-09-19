"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/context/UserContext";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import {
  Receipt,
  ShoppingBag,
  CheckCircle2,
  Flame,
  Settings,
  Zap,
  CreditCard,
  Sparkles,
  Coins,
  Package,
  Wrench,
  Layers,
  Handshake,
} from "lucide-react";

const CREDIT_EVENT_META = {
  kyc_verification_complete: { label: "KYC Verification Bonus", Icon: CheckCircle2 },
  confirmed_sale: { label: "Confirmed Sale Reward", Icon: Handshake },
  weekly_active_streak: { label: "Weekly Activity Streak", Icon: Flame },
  admin_adjustment: { label: "Account Adjustment", Icon: Settings },
  spend_boost: { label: "Boost Purchase", Icon: Zap },
  spend_premium_plan: { label: "Plan Purchase", Icon: CreditCard },
  spend_cosmetic_frame: { label: "Cosmetic Frame", Icon: Sparkles },
};

const CATEGORY_ICON = {
  boost: Zap,
  product_premium: Package,
  service_premium: Wrench,
  bundle: Layers,
};

const STATUS_BADGE = {
  Completed: { variant: "success" },
  "In progress": { variant: "secondary" },
  Cancelled: { variant: "outline" },
  "Under review": { variant: "outline", className: "bg-amber-50 text-amber-700 border-amber-200" },
  Failed: { variant: "destructive" },
  Unknown: { variant: "outline" },
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TransactionRow({ entry }) {
  const statusMeta = STATUS_BADGE[entry.status] || STATUS_BADGE.Unknown;

  if (entry.kind === "credit_event") {
    const meta = CREDIT_EVENT_META[entry.type] || { label: entry.type, Icon: Coins };
    const Icon = meta.Icon;
    const isPositive = entry.ledgerAmount > 0;

    return (
      <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-gray-100 last:border-b-0">
        <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${isPositive ? "bg-green-50" : "bg-red-50"}`}>
          <Icon className={`h-5 w-5 ${isPositive ? "text-green-600" : "text-red-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{meta.label}</p>
          {entry.reason && <p className="text-xs text-gray-500 truncate">{entry.reason}</p>}
          <p className="text-xs text-gray-400">{formatDate(entry.createdAtISO)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}>
            {isPositive ? "+" : ""}
            {entry.ledgerAmount.toLocaleString()} credits
          </p>
        </div>
      </div>
    );
  }

  // kind === "purchase"
  const CategoryIcon = CATEGORY_ICON[entry.category] || Receipt;
  const fullyCredited = entry.nairaAmount === 0 && entry.creditApplied > 0;

  return (
    <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-gray-100 last:border-b-0">
      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <CategoryIcon className="h-5 w-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
          <Badge variant={statusMeta.variant} className={statusMeta.className}>
            {entry.status}
          </Badge>
        </div>
        {entry.creditApplied > 0 && (
          <p className="text-xs text-gray-500">{entry.creditApplied.toLocaleString()} credits applied</p>
        )}
        {entry.boostStatus && <p className="text-xs text-gray-400 capitalize">Boost: {entry.boostStatus}</p>}
        <p className="text-xs text-gray-400">{formatDate(entry.createdAtISO)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-gray-900">
          {fullyCredited ? "Covered by credit" : `₦${entry.nairaAmount.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-gray-100 last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser();
  const { balance, loading: balanceLoading } = useCreditBalance(currentUser?.uid);
  // Infinite-scroll pagination (20/page) over GET /api/transactions — see
  // hooks/useTransactionHistory.js and lib/transactionHistoryServer.js.
  // Caveat: that endpoint merges creditLedger/pendingSpends/
  // subscriptionPayments/boostCredits by fetching each source's most recent
  // 200 records, then paginates the merged result in memory rather than via
  // true cross-collection cursors. Pagination itself works correctly no
  // matter how far a user scrolls; the tradeoff is that anything older than
  // the 200-per-source window wouldn't surface. Not a real constraint at
  // current per-user transaction volume — a deliberate v1 simplification,
  // not a bug.
  const { entries, initialLoading, isFetchingMore, hasMore, loadMore, error } = useTransactionHistory(currentUser?.uid);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries[0].isIntersecting && !isFetchingMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    const current = bottomRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [loadMore, isFetchingMore]);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Header title="Transactions" />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {balanceLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : balance.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">App Credit Balance</div>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{entries.length}</div>
              <div className="text-sm text-gray-600">Transactions Loaded</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>
        )}

        {initialLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 max-w-md w-full text-center">
              <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Receipt className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-600 leading-relaxed mb-6">
                Your App Credit earnings, subscription payments, and boosts will show up here once you have some activity.
              </p>
              <Button
                onClick={() => router.push("/")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Browse Marketplace
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {entries.map((entry) => (
              <TransactionRow key={entry.id} entry={entry} />
            ))}
            {isFetchingMore && <TransactionRowSkeleton />}
          </div>
        )}

        {hasMore && <div ref={bottomRef} />}
      </div>
    </div>
  );
}
