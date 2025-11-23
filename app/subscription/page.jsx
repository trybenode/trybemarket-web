"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { Check, Sparkles, Crown, Shield, Zap, AlertCircle } from "lucide-react";
import Header from "@/components/Header";
import { SUBSCRIPTION_PLANS, getPlansByCategory, checkPlanEligibility } from "@/lib/subscriptionStore";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_TEST_KEY;

  const {
    subscriptions,
    limits,
    loading: subLoading,
    getCurrentPlan,
  } = useSubscription(user?.uid);

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
    if (!user?.uid) return;

    const checkAllPlansEligibility = async () => {
      const eligibilityChecks = {};
      
      // Check all plans
      const allPlans = [
        ...getPlansByCategory("product"),
        ...getPlansByCategory("service"),
        ...getPlansByCategory("bundle"),
        ...getPlansByCategory("boost"),
      ];

      for (const plan of allPlans) {
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
  }, [user]);

  const handlePlanSelect = (plan) => {
    // Check if user is KYC verified before allowing subscription
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
  };

  const handlePaymentSuccess = async (response) => {
    try {
      setLoading(true);
      toast.loading("Verifying payment...", { id: "verify" });

      const verifyRes = await fetch("/api/subscription/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: response.reference,
          userId: user.uid,
          planId: selectedPlan.id,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || "Payment verification failed");
      }

      toast.success("Subscription activated! ", { id: "verify" });
      
      setSelectedPlan(null);
      setReference(`${user.uid}-${Date.now()}`);
      
      router.push("/thank-you");
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
    setSelectedPlan(null);
  };

  const createPaystackProps = (plan) => ({
    email: user?.email,
    amount: plan.price * 100,
    reference: reference,
    metadata: {
      userId: user?.uid,
      planId: plan.id,
      planName: plan.name,
      category: plan.category,
    },
    publicKey,
    text: `Pay ${plan.price.toLocaleString()}`,
    onSuccess: handlePaymentSuccess,
    onClose: handlePaymentClose,
  });

  const isPlanActive = (planId, category) => {
    if (!subscriptions) return false;
    if (subscriptions.bundle?.isActive && subscriptions.bundle?.planId === planId) {
      return true;
    }
    if (subscriptions[category]?.isActive && subscriptions[category]?.planId === planId) {
      return true;
    }
    return false;
  };

  const renderPlanCard = (plan) => {
    const isActive = isPlanActive(plan.id, plan.category);
    const isFree = plan.price === 0;
    const eligibility = planEligibility[plan.id] || { eligible: true };
    const isEligible = eligibility.eligible;

    return (
      <Card
        key={plan.id}
        className={`relative overflow-hidden transition-all ${
          isActive ? "border-blue-500 border-2 shadow-lg" : ""
        } ${plan.type === "vip" ? "border-yellow-400" : ""} ${
          !isEligible && !isFree ? "opacity-60" : ""
        }`}
      >
        {plan.type === "vip" && (
          <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-400 to-yellow-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg">
            POPULAR
          </div>
        )}

        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-xl">
              {plan.name}
              {plan.type === "vip" && <Crown className="inline ml-2 h-5 w-5 text-yellow-500" />}
              {plan.type === "premium" && <Sparkles className="inline ml-2 h-5 w-5 text-blue-500" />}
              {plan.type === "maintenance" && <Shield className="inline ml-2 h-5 w-5 text-gray-500" />}
            </CardTitle>
            {isActive && (
              <Badge variant="success" className="bg-green-500 text-white">
                Active
              </Badge>
            )}
          </div>

          <CardDescription className="text-2xl font-bold text-gray-900">
            {isFree ? (
              "Free"
            ) : (
              <>
                ₦{plan.price.toLocaleString()}
                <span className="text-sm font-normal text-gray-500">
                  /{plan.cycle === "one-time" ? "7 days" : plan.cycle === "quarterly" ? "3 months" : plan.cycle === "yearly" ? "year" : "month"}
                </span>
              </>
            )}
          </CardDescription>

          {plan.eligibility?.requiresPaidMonths > 0 && (
            <Badge variant="outline" className="mt-2 w-fit">
              Requires {plan.eligibility.requiresPaidMonths} paid months
            </Badge>
          )}

          {!isEligible && plan.eligibility?.requiresPaidMonths > 0 && (
            <Badge variant="destructive" className="mt-2 w-fit">
              🔒 Locked
            </Badge>
          )}
        </CardHeader>

        <CardContent>
          <ul className="space-y-2">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {plan.limits && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
              <strong>Limits:</strong>
              {plan.limits.maxProducts && (
                <div> Products: {plan.limits.maxProducts === 9999 ? "Unlimited" : plan.limits.maxProducts}</div>
              )}
              {plan.limits.maxServices && (
                <div> Services: {plan.limits.maxServices}</div>
              )}
              {plan.limits.vipTags > 0 && <div> VIP Tags: {plan.limits.vipTags}</div>}
            </div>
          )}
        </CardContent>

        <CardFooter>
          {isFree ? (
            <Button className="w-full" variant="outline" disabled>
              {isActive ? "Current Plan" : "Default Plan"}
            </Button>
          ) : isActive ? (
            <Button className="w-full" variant="outline" disabled>
               Subscribed
            </Button>
          ) : !isEligible ? (
            <div className="w-full">
              <Button className="w-full" variant="outline" disabled>
                Not Eligible
              </Button>
              <p className="text-xs text-red-600 mt-2 text-center">
                {eligibility.reason}
              </p>
            </div>
          ) : (
            <>
              {selectedPlan?.id === plan.id ? (
                loadingUser || !user?.email || !reference || !publicKey ? (
                  <Button className="w-full" disabled>
                    Loading...
                  </Button>
                ) : (
                  <PaystackWrapper
                    props={createPaystackProps(plan)}
                    loading={loading}
                  />
                )
              ) : (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => handlePlanSelect(plan)}
                  disabled={!isKycVerified}
                >
                  {!isKycVerified ? "KYC Required" : "Subscribe Now"}
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen px-4 py-8">
      <Header title="Subscription Plans" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Choose Your Plan
          </h1>
          <p className="text-gray-600">
            Unlock exclusive features to grow your store faster
          </p>
        </div>

        {/* KYC Verification Alert */}
        {!checkingKyc && !isKycVerified && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>KYC Verification Required</AlertTitle>
            <AlertDescription>
              You must complete KYC verification before subscribing to any plan.{" "}
              <button
                onClick={() => router.push("/kyc")}
                className="underline font-semibold hover:text-red-700"
              >
                Complete KYC now
              </button>
            </AlertDescription>
          </Alert>
        )}

        {!subLoading && limits && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              Your Current Limits
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Products</p>
                <p className="font-bold text-lg">
                  {limits.maxProducts === 9999 ? "Unlimited" : limits.maxProducts}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Services</p>
                <p className="font-bold text-lg">
                  {limits.maxServices === 9999 ? "Unlimited" : limits.maxServices}
                </p>
              </div>
              <div>
                <p className="text-gray-500">VIP Tags</p>
                <p className="font-bold text-lg">{limits.vipTags || 0}</p>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="product">Products</TabsTrigger>
            <TabsTrigger value="service">Services</TabsTrigger>
            <TabsTrigger value="bundle">Bundles</TabsTrigger>
            <TabsTrigger value="boost">Boosts</TabsTrigger>
          </TabsList>

          <TabsContent value="product">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {getPlansByCategory("product").map((plan) => renderPlanCard(plan))}
            </div>
          </TabsContent>

          <TabsContent value="service">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {getPlansByCategory("service").map((plan) => renderPlanCard(plan))}
            </div>
          </TabsContent>

          <TabsContent value="bundle">
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                {getPlansByCategory("bundle").map((plan) => renderPlanCard(plan))}
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">
                  💡 Save More with Longer Plans
                </h4>
                <p className="text-sm text-blue-700">
                  Monthly Bundle: ₦2,500/month • Quarterly: ₦3,000 (save ₦4,500) • Yearly: ₦10,000 (save ₦20,000)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="boost">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">
                  🚀 Boost Your Visibility
                </h4>
                <p className="text-sm text-yellow-700">
                  One-time boosts give your products/services maximum exposure for 7 days. Perfect for special promotions or new launches!
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {getPlansByCategory("boost").map((plan) => renderPlanCard(plan))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4 text-sm">
            <div>
              <strong>Q: Can I upgrade my plan anytime?</strong>
              <p className="text-gray-600">Yes! You can upgrade at any time. Your new benefits will be active immediately.</p>
            </div>
            <div>
              <strong>Q: What happens when my subscription expires?</strong>
              <p className="text-gray-600">You'll automatically return to the free plan. Your listings will remain but with limited features.</p>
            </div>
            <div>
              <strong>Q: What is a Maintenance plan?</strong>
              <p className="text-gray-600">After 3 paid months, you can switch to a maintenance plan at 700/month to keep your content active without premium features.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
