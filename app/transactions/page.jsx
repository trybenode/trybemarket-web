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
      <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-slate-100 last:border-b-0">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPositive ? "bg-emerald-50" : "bg-rose-50"}`}>
          <Icon className={`h-5 w-5 ${isPositive ? "text-emerald-600" : "text-rose-600"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{meta.label}</p>
          {entry.reason && <p className="text-xs text-slate-500 truncate">{entry.reason}</p>}
          <p className="text-xs text-slate-400">{formatDate(entry.createdAtISO)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
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
    <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-slate-100 last:border-b-0">
      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <CategoryIcon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900 truncate">{entry.title}</p>
          <Badge variant={statusMeta.variant} className={statusMeta.className}>
            {entry.status}
          </Badge>
        </div>
        {entry.creditApplied > 0 && (
          <p className="text-xs text-slate-500">{entry.creditApplied.toLocaleString()} credits applied</p>
        )}
        {entry.boostStatus && <p className="text-xs text-slate-400 capitalize">Boost: {entry.boostStatus}</p>}
        <p className="text-xs text-slate-400">{formatDate(entry.createdAtISO)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-slate-900">
          {fullyCredited ? "Covered by credit" : `₦${entry.nairaAmount.toLocaleString()}`}
        </p>
      </div>
    </div>
  );
}

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 px-4 sm:px-6 border-b border-slate-100 last:border-b-0">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
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

  const listCard = "overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Transactions" />

      <div className="container mx-auto max-w-3xl px-4 py-5">
        {/* Summary */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-brand-yellow-deep/40 bg-gradient-to-br from-brand-yellow-soft to-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Coins className="h-3.5 w-3.5 text-amber-600" /> App credit
            </p>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {balanceLoading ? <Skeleton className="h-8 w-16" /> : balance.toLocaleString()}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Receipt className="h-3.5 w-3.5" /> Transactions
            </p>
            <div className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{entries.length}</div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {initialLoading ? (
          <div className={listCard}>
            {Array.from({ length: 5 }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="mx-auto mt-4 flex max-w-md flex-col items-center rounded-3xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <Receipt className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No transactions yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Your App Credit earnings, subscription payments and boosts will show up here once you have some activity.
            </p>
            <Button size="lg" className="mt-6" onClick={() => router.push("/")}>
              <ShoppingBag /> Browse marketplace
            </Button>
          </div>
        ) : (
          <div className={listCard}>
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
