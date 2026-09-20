"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { Check, Sparkles, Crown, Shield, Zap, AlertCircle, Coins, Lock } from "lucide-react";
import Header from "@/components/Header";
import { SUBSCRIPTION_PLANS, getPlansByCategory, checkPlanEligibility, isSubscriptionActive } from "@/lib/subscriptionStore";
import { computeSellerTier, getTierWeight } from "@/lib/sellerTier";
import { CREDIT_SPEND_CAPS } from "@/lib/creditConstants";
import { useSubscription } from "@/hooks/useSubscription";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PaystackWrapper = dynamic(() => import("@/components/PaystackWrapper"), {
  ssr: false,
});

export default function SubscriptionPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [reference, setReference] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("product");
  const [isKycVerified, setIsKycVerified] = useState(false);
  const [checkingKyc, setCheckingKyc] = useState(true);
  const [planEligibility, setPlanEligibility] = useState({});
  const [dbPlans, setDbPlans] = useState([]);
  const [loadingDbPlans, setLoadingDbPlans] = useState(true);

  // Credit-assisted checkout — see credit-spending-security-checklist.md.
  // Credit is applied by DEFAULT (change-answers.md §2) with an opt-out
  // toggle, shown up front on each card before it's selected — a plan's id
  // in this set means the seller opted OUT of applying credit to it.
  // creditReservation is null until reserveCredit resolves via
  // /api/credit/spend/reserve, triggered directly by "Subscribe Now" so
  // there's no separate confirmation click in between.
  const [creditOptOutPlanIds, setCreditOptOutPlanIds] = useState(new Set());
  const [creditReservation, setCreditReservation] = useState(null);
  const [reserving, setReserving] = useState(false);

  const isApplyingCreditFor = (planId) => !creditOptOutPlanIds.has(planId);
  const toggleCreditOptOut = (planId) => {
    setCreditOptOutPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

  const {
    subscriptions,
    limits,
    loading: subLoading,
    getCurrentPlan,
  } = useSubscription(user?.uid);

  const { balance: creditBalance, loading: creditLoading } = useCreditBalance(user?.uid);

  // Fetch subscription plans from Firestore database
  useEffect(() => {
    const fetchDatabasePlans = async () => {
      try {
        setLoadingDbPlans(true);
        const plansCollection = collection(db, "subscriptionPlans");
        const plansSnapshot = await getDocs(plansCollection);
        
        const plans = [];
        plansSnapshot.forEach((doc) => {
          plans.push({
            id: doc.id,
            ...doc.data()
          });
        });

        console.log("=== SUBSCRIPTION PLANS FROM DATABASE ===");
        console.log("Total plans found:", plans.length);
        console.log("Full plans data:", JSON.stringify(plans, null, 2));
        
        // Filter boost plans specifically
        const boostPlans = plans.filter(plan => plan.category === "boost");
        console.log("=== BOOST PLANS ONLY ===");
        console.log("Number of boost plans:", boostPlans.length);
        console.log("Boost plans data:", JSON.stringify(boostPlans, null, 2));
        
        setDbPlans(plans);
      } catch (error) {
        console.error("Error fetching subscription plans from database:", error);
      } finally {
        setLoadingDbPlans(false);
      }
    };

    fetchDatabasePlans();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setReference(`${currentUser.uid}-${Date.now()}`);
        
        // Check KYC verification status
        try {
          setCheckingKyc(true);
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setIsKycVerified(userData.isVerified || false);
          } else {
            setIsKycVerified(false);
          }
        } catch (error) {
          console.error("Error checking KYC status:", error);
          setIsKycVerified(false);
        } finally {
          setCheckingKyc(false);
        }
      } else {
        router.push("/login");
      }
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Check plan eligibility when user changes
  useEffect(() => {
    if (!user?.uid || dbPlans.length === 0) return;

    const checkAllPlansEligibility = async () => {
      const eligibilityChecks = {};
      
      // Check all plans from database
      for (const plan of dbPlans) {
        if (plan.eligibility?.requiresPaidMonths > 0) {
          const result = await checkPlanEligibility(user.uid, plan.id);
          eligibilityChecks[plan.id] = result;
        } else {
          eligibilityChecks[plan.id] = { eligible: true };
        }
      }

      setPlanEligibility(eligibilityChecks);
    };

    checkAllPlansEligibility();
  }, [user, dbPlans]);

  const redirectAfterActivation = (plan) => {
    setSelectedPlan(null);
    setCreditReservation(null);
    setReference(`${user.uid}-${Date.now()}`);

    if (plan.category === "boost") {
      toast.success("Now select an item to boost!", { duration: 3000 });
      setTimeout(() => {
        router.push("/select-boost-item");
      }, 1500);
    } else {
      router.push("/thank-you");
    }
  };

  const handlePaymentSuccess = async (response) => {
    try {
      setLoading(true);
      toast.loading("Verifying payment...", { id: "verify" });

      const isCreditAssisted = creditReservation?.applyCredit === true;
      const verifyUrl = isCreditAssisted ? "/api/credit/spend/verify" : "/api/subscription/verify-payment";
      const headers = { "Content-Type": "application/json" };
      let body;

      if (isCreditAssisted) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
        body = { reference: response.reference };
      } else {
        body = { reference: response.reference, userId: user.uid, planId: selectedPlan.id };
      }

      const verifyRes = await fetch(verifyUrl, { method: "POST", headers, body: JSON.stringify(body) });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || "Payment verification failed");
      }

      toast.success("Subscription activated! ", { id: "verify" });
      redirectAfterActivation(selectedPlan);
    } catch (error) {
      console.error("Payment verification error:", error);
      toast.error(error.message || "Failed to activate subscription", {
        id: "verify",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentClose = () => {
    toast.error("Payment cancelled");

    if (creditReservation?.applyCredit) {
      // Credit was reserved for this attempt — release it immediately,
      // otherwise the seller's balance stays locked and reserveCredit's
      // "one active reservation" guard blocks any retry for up to
      // PENDING_SPEND_TIMEOUT_MS (30 min), until the lazy-expiry/cron path
      // eventually catches it.
      const creditVoidReference = creditReservation.reference;
      user
        .getIdToken()
        .then((idToken) =>
          fetch("/api/credit/spend/void", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ reference: creditVoidReference }),
          })
        )
        .catch((error) => console.error("Failed to release credit reservation:", error));
    } else if (selectedPlan && reference) {
      // The plain (non-credit) flow never calls the server at all on a
      // cancelled/declined attempt otherwise — see
      // app/api/subscription/log-failed-payment/route.js — so the
      // transactions history page would have zero record of it.
      user
        .getIdToken()
        .then((idToken) =>
          fetch("/api/subscription/log-failed-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ reference, planId: selectedPlan.id }),
          })
        )
        .catch((error) => console.error("Failed to log cancelled payment:", error));
    }

    setSelectedPlan(null);
    setCreditReservation(null);
  };

  // Client-side ESTIMATE only, for display before the user commits — the
  // server (lib/creditSpendServer.js) independently recomputes this from the
  // real plan price/cap and is the only thing that actually decides the
  // amount applied. Never trust this value for anything but showing a number.
  const getCreditEligibility = (plan) => {
    if (!plan || !plan.price || creditBalance <= 0) return null;
    const capKey = plan.category === "boost" ? "boost" : plan.id;
    const capPercent = CREDIT_SPEND_CAPS[capKey];
    if (!capPercent) return null;
    const maxCoverage = Math.floor(plan.price * capPercent);
    const estimatedApply = Math.min(creditBalance, maxCoverage);
    return estimatedApply > 0 ? { estimatedApply } : null;
  };

  // Single click handler for "Subscribe Now" — the credit opt-out toggle is
  // decided up front (isApplyingCreditFor), so this goes straight to
  // reserving credit (if eligible) with no separate "Continue" step in
  // between. The Paystack button appears as soon as this resolves.
  const handleSubscribeClick = async (plan) => {
    if (!isKycVerified) {
      toast.error("Please complete KYC verification before subscribing", {
        duration: 4000,
      });
      setTimeout(() => {
        router.push("/kyc");
      }, 2000);
      return;
    }

    setSelectedPlan(plan);
    setCreditReservation(null);

    const eligibility = getCreditEligibility(plan);
    if (!eligibility) {
      // Nothing to reserve — identical to the pre-credit flow.
      setCreditReservation({ applyCredit: false });
      return;
    }

    try {
      setReserving(true);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/credit/spend/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ itemId: plan.id, applyCredit: isApplyingCreditFor(plan.id) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to apply credit");
      }

      if (data.applyCredit && data.fullyCovered) {
        toast.success("Fully covered by your App Credit! 🎉");
        redirectAfterActivation(plan);
        return;
      }

      setCreditReservation(data);
    } catch (error) {
      toast.error(error.message || "Failed to apply credit");
      setSelectedPlan(null);
    } finally {
      setReserving(false);
    }
  };

  const createPaystackProps = (plan) => {
    const isCreditAssisted = creditReservation?.applyCredit === true;
    const amount = isCreditAssisted ? creditReservation.remainingAmount * 100 : plan.price * 100;
    const payReference = isCreditAssisted ? creditReservation.reference : reference;

    return {
      email: user?.email,
      amount,
      reference: payReference,
      metadata: {
        userId: user?.uid,
        planId: plan.id,
        planName: plan.name,
        category: plan.category,
      },
      publicKey,
      text: `Pay ₦${(amount / 100).toLocaleString()}`,
      onSuccess: handlePaymentSuccess,
      onClose: handlePaymentClose,
    };
  };

  const isPlanActive = (planId, category) => {
    if (!subscriptions) return false;
    if (subscriptions.bundle && isSubscriptionActive(subscriptions.bundle) && subscriptions.bundle.planId === planId) {
      return true;
    }
    if (subscriptions[category] && isSubscriptionActive(subscriptions[category]) && subscriptions[category].planId === planId) {
      return true;
    }
    return false;
  };

  // VIP is an upgrade over Premium within the same category (product/
  // service), not a separate track — computeSellerTier is the same
  // tier-hierarchy logic the ranking system already trusts server-side
  // (lib/rankScoreServer.js), reused here client-side (it's pure, no
  // Firestore imports) so this can't drift out of sync with what actually
  // determines rankScore. Without this, a VIP subscriber could still click
  // "Subscribe Now" on Premium for the same category — and since
  // fulfillPlanPurchase writes subscriptions[category] wholesale, that would
  // silently overwrite (and lose) their active VIP subscription with a
  // lesser one they just paid for again.
  const isPlanCoveredByCurrentTier = (plan) => {
    if (!["product", "service"].includes(plan.category)) return false;
    if (!["premium", "vip"].includes(plan.type)) return false;
    if (!subscriptions) return false;
    const currentTier = computeSellerTier(subscriptions, plan.category);
    return currentTier !== "free" && getTierWeight(plan.type) <= getTierWeight(currentTier);
  };

  const renderCheckoutControls = (plan) => {
    if (selectedPlan?.id !== plan.id) {
      // Not selected yet — show the credit opt-out toggle inline (if this
      // plan has eligible credit to apply) right above the single Subscribe
      // button, so applying credit costs no extra click or confirmation.
      const eligibility = getCreditEligibility(plan);
      return (
        <div className="w-full space-y-3">
          {eligibility && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-brand-yellow-deep/50 bg-brand-yellow-soft p-3 text-sm">
              <input
                type="checkbox"
                checked={isApplyingCreditFor(plan.id)}
                onChange={() => toggleCreditOptOut(plan.id)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-primary"
              />
              <span className="text-slate-800">
                Apply {eligibility.estimatedApply.toLocaleString()} credits — covers ₦{eligibility.estimatedApply.toLocaleString()} of this ₦{plan.price.toLocaleString()} plan
              </span>
            </label>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={() => handleSubscribeClick(plan)}
            disabled={!isKycVerified}
          >
            {!isKycVerified ? "KYC required" : "Subscribe now"}
          </Button>
        </div>
      );
    }

    // Selected, reserve call still in flight.
    if (creditReservation === null) {
      return (
        <Button size="lg" className="w-full" loading>
          {reserving ? "Applying credit…" : "Loading…"}
        </Button>
      );
    }

    // Reservation resolved (with or without credit applied) — pay whatever's left via Paystack.
    if (loadingUser || !user?.email || !publicKey || (!creditReservation.applyCredit && !reference)) {
      return (
        <Button size="lg" className="w-full" loading>
          Loading…
        </Button>
      );
    }

    return (
      <div className="w-full space-y-2">
        {creditReservation.applyCredit && (
          <p className="text-center text-xs text-slate-500">
            {creditReservation.creditApplied.toLocaleString()} credits applied — pay the remaining ₦{creditReservation.remainingAmount.toLocaleString()}
          </p>
        )}
        <PaystackWrapper props={createPaystackProps(plan)} loading={loading} />
      </div>
    );
  };

  const renderPlanCard = (plan) => {
    const isActive = isPlanActive(plan.id, plan.category);
    const isFree = plan.price === 0;
    const eligibility = planEligibility[plan.id] || { eligible: true };
    const isEligible = eligibility.eligible;
    const isCovered = !isActive && isPlanCoveredByCurrentTier(plan);
    const isVip = plan.type === "vip";
    const cycle =
      plan.cycle === "one-time" ? "7 days" : plan.cycle === "quarterly" ? "3 months" : plan.cycle === "yearly" ? "year" : "month";

    const TypeIcon = isVip ? Crown : plan.type === "premium" ? Sparkles : plan.type === "maintenance" ? Shield : Zap;
    const iconTone = isVip
      ? "bg-brand-yellow text-slate-900"
      : plan.type === "premium"
      ? "bg-blue-50 text-primary"
      : "bg-slate-100 text-slate-600";

    return (
      <div
        key={plan.id}
        className={cn(
          "relative flex flex-col rounded-3xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
          isActive
            ? "border-primary ring-2 ring-primary/20"
            : isVip
            ? "border-brand-yellow-deep ring-2 ring-brand-yellow/50"
            : "border-slate-200",
          (!isEligible || isCovered) && !isFree && "opacity-75"
        )}
      >
        {isVip && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-yellow px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-900 shadow-sm">
            Most popular
          </span>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconTone)}>
              <TypeIcon className="h-[18px] w-[18px]" />
            </span>
            <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
          </div>
          {isActive && <Badge variant="default">Active</Badge>}
        </div>

        <p className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
          {isFree ? (
            "Free"
          ) : (
            <>
              ₦{plan.price.toLocaleString()}
              <span className="ml-1 text-sm font-medium text-slate-500">/{cycle}</span>
            </>
          )}
        </p>

        {(plan.eligibility?.requiresPaidMonths > 0 || (!isEligible && plan.eligibility?.requiresPaidMonths > 0)) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.eligibility?.requiresPaidMonths > 0 && (
              <Badge variant="outline">Requires {plan.eligibility.requiresPaidMonths} paid months</Badge>
            )}
            {!isEligible && (
              <Badge variant="warning">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
          </div>
        )}

        <ul className="mt-4 space-y-2.5">
          {plan.features?.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {plan.limits && (
          <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Limits</p>
            {plan.limits.maxProducts && (
              <p>Products: {plan.limits.maxProducts === 9999 ? "Unlimited" : plan.limits.maxProducts}</p>
            )}
            {plan.limits.maxServices && (
              <p>Services: {plan.limits.maxServices === 9999 ? "Unlimited" : plan.limits.maxServices}</p>
            )}
            {plan.limits.vipTags > 0 && <p>VIP tags: {plan.limits.vipTags}</p>}
            {plan.limits.durationDays && <p>Duration: {plan.limits.durationDays} days</p>}
          </div>
        )}

        <div className="mt-auto pt-5">
          {isFree ? (
            <Button className="w-full" size="lg" variant="secondary" disabled>
              {isActive ? "Current plan" : "Default plan"}
            </Button>
          ) : isActive ? (
            <Button className="w-full" size="lg" variant="soft" disabled>
              <Check /> Subscribed
            </Button>
          ) : isCovered ? (
            <div className="w-full">
              <Button className="w-full" size="lg" variant="secondary" disabled>
                Included in your plan
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Your current {plan.category} plan already covers this
              </p>
            </div>
          ) : !isEligible ? (
            <div className="w-full">
              <Button className="w-full" size="lg" variant="secondary" disabled>
                Not eligible
              </Button>
              <p className="mt-2 text-center text-xs text-red-600">{eligibility.reason}</p>
            </div>
          ) : (
            renderCheckoutControls(plan)
          )}
        </div>
      </div>
    );
  };

  // Free first, maintenance last, the rest by price — same order as before.
  const sortPlans = (list) =>
    [...list].sort((a, b) => {
      if (a.type === "maintenance") return 1;
      if (b.type === "maintenance") return -1;
      if (a.price === 0) return -1;
      if (b.price === 0) return 1;
      return a.price - b.price;
    });

  const renderPlans = (category, { sort = false, cols = "lg:grid-cols-4" } = {}) => {
    if (loadingDbPlans) {
      return (
        <div className={cn("grid gap-4 pt-3 sm:grid-cols-2", cols)} aria-busy="true">
          {Array.from({ length: cols.includes("3") ? 3 : 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-3xl" />
          ))}
        </div>
      );
    }
    const list = dbPlans.filter((plan) => plan.category === category);
    return (
      <div className={cn("grid gap-4 pt-3 sm:grid-cols-2", cols)}>
        {(sort ? sortPlans(list) : list).map((plan) => renderPlanCard(plan))}
      </div>
    );
  };

  const limitTiles = limits
    ? [
        ["Products", limits.maxProducts === 9999 ? "∞" : limits.maxProducts, false],
        ["Services", limits.maxServices === 9999 ? "∞" : limits.maxServices, false],
        ["Product VIP tags", limits.vipTagsProduct || 0, true],
        ["Service VIP tags", limits.vipTagsService || 0, true],
      ]
    : [];

  const faqs = [
    ["Can I upgrade my plan anytime?", "Yes! You can upgrade at any time. Your new benefits will be active immediately."],
    [
      "What happens when my subscription expires?",
      "You'll automatically return to the free plan. Your listings will remain but with limited features.",
    ],
    [
      "What is a Maintenance plan?",
      "After 3 paid months, you can switch to a maintenance plan at ₦700/month to keep your content active without premium features.",
    ],
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="Subscription plans" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Hero */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Choose your plan</h1>
          <p className="mt-1 text-sm text-slate-600">Unlock features to grow your store faster</p>
        </div>

        {/* KYC required */}
        {!checkingKyc && !isKycVerified && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">KYC verification required</h3>
              <p className="mt-0.5 text-sm text-red-700">You must complete KYC verification before subscribing to any plan.</p>
              <Button size="sm" variant="destructive" className="mt-3" onClick={() => router.push("/kyc")}>
                Complete KYC now
              </Button>
            </div>
          </div>
        )}

        {/* Credit + limits */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          {!creditLoading && (
            <div className="rounded-3xl border border-brand-yellow-deep/40 bg-gradient-to-br from-brand-yellow-soft to-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-yellow text-slate-900">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500">App credit</p>
                  <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                    {creditBalance.toLocaleString()} <span className="text-sm font-semibold text-slate-500">credits</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Earned from KYC verification and confirmed sales. Applied automatically at checkout on eligible plans.
              </p>
            </div>
          )}

          {!subLoading && limits && (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Zap className="h-4 w-4 text-primary" /> Your current limits
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {limitTiles.map(([label, value, accent]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={cn("mt-0.5 text-2xl font-extrabold tabular-nums", accent ? "text-primary" : "text-slate-900")}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plans */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4 sm:mx-auto sm:max-w-md">
            <TabsTrigger value="product" className="px-1.5 sm:px-3">Products</TabsTrigger>
            <TabsTrigger value="service" className="px-1.5 sm:px-3">Services</TabsTrigger>
            <TabsTrigger value="bundle" className="px-1.5 sm:px-3">Bundles</TabsTrigger>
            <TabsTrigger value="boost" className="px-1.5 sm:px-3">Boosts</TabsTrigger>
          </TabsList>

          <TabsContent value="product">{renderPlans("product", { sort: true })}</TabsContent>
          <TabsContent value="service">{renderPlans("service", { sort: true })}</TabsContent>

          <TabsContent value="bundle">
            <div className="space-y-4">
              {renderPlans("bundle", { cols: "lg:grid-cols-3" })}
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Save more with longer plans</h4>
                  <p className="mt-0.5 text-sm text-slate-600">
                    Monthly ₦2,500/month · Quarterly ₦6,000 (save ₦1,500) · Yearly ₦21,000 (save ₦9,000)
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boost">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-brand-yellow-deep/40 bg-brand-yellow-soft p-4">
                <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Boost your visibility</h4>
                  <p className="mt-0.5 text-sm text-slate-600">
                    One-time boosts give your products or services maximum exposure for 7 days — perfect for promotions and new launches.
                  </p>
                </div>
              </div>
              {renderPlans("boost", { cols: "lg:grid-cols-3" })}
            </div>
          </TabsContent>
        </Tabs>

        {/* FAQ */}
        <div className="mx-auto mt-12 w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-primary" /> Frequently asked questions
          </h3>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="border-slate-200">
                <AccordionTrigger className="text-left text-sm font-semibold text-slate-900">{q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-600">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
