"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
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
  const [dbPlans, setDbPlans] = useState([]);
  const [loadingDbPlans, setLoadingDbPlans] = useState(true);

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_KEY;

  const {
    subscriptions,
    limits,
    loading: subLoading,
    getCurrentPlan,
  } = useSubscription(user?.uid);

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
        className={`relative overflow-hidden transition-all border ${
          isActive 
            ? "border-2 shadow-lg" 
            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
        } ${plan.type === "vip" ? "border-yellow-400" : ""} ${
          !isEligible && !isFree ? "opacity-60" : ""
        } bg-white rounded-lg`}
        style={isActive ? { borderColor: 'rgb(37,99,235)' } : {}}
      >
        {plan.type === "vip" && (
          <div className="absolute top-0 right-0 bg-gradient-to-l from-yellow-400 to-yellow-500 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
            POPULAR
          </div>
        )}

        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {plan.name}
              {plan.type === "vip" && <Crown className="inline ml-2 h-5 w-5 text-yellow-500" />}
              {plan.type === "premium" && <Sparkles className="inline ml-2 h-5 w-5" style={{ color: 'rgb(37,99,235)' }} />}
              {plan.type === "maintenance" && <Shield className="inline ml-2 h-5 w-5 text-gray-500" />}
            </CardTitle>
            {isActive && (
              <Badge className="text-white text-xs" style={{ backgroundColor: 'rgb(37,99,235)' }}>
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
            <Badge variant="outline" className="mt-2 w-fit text-xs border-gray-300">
              Requires {plan.eligibility.requiresPaidMonths} paid months
            </Badge>
          )}

          {!isEligible && plan.eligibility?.requiresPaidMonths > 0 && (
            <Badge variant="destructive" className="mt-2 w-fit text-xs">
              🔒 Locked
            </Badge>
          )}
        </CardHeader>

        <CardContent>
          <ul className="space-y-2.5">
            {plan.features?.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'rgb(37,99,235)' }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {plan.limits && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
              <strong className="text-gray-900">Limits:</strong>
              {plan.limits.maxProducts && (
                <div className="mt-1">✓ Products: {plan.limits.maxProducts === 9999 ? "Unlimited" : plan.limits.maxProducts}</div>
              )}
              {plan.limits.maxServices && (
                <div className="mt-1">✓ Services: {plan.limits.maxServices === 9999 ? "Unlimited" : plan.limits.maxServices}</div>
              )}
              {plan.limits.vipTags > 0 && <div className="mt-1">✓ VIP Tags: {plan.limits.vipTags}</div>}
              {plan.limits.durationDays && <div className="mt-1">✓ Duration: {plan.limits.durationDays} days</div>}
            </div>
          )}
        </CardContent>

        <CardFooter>
          {isFree ? (
            <Button className="w-full bg-gray-100 text-gray-600" variant="outline" disabled>
              {isActive ? "Current Plan" : "Default Plan"}
            </Button>
          ) : isActive ? (
            <Button className="w-full" variant="outline" disabled style={{ borderColor: 'rgb(37,99,235)', color: 'rgb(37,99,235)' }}>
              ✓ Subscribed
            </Button>
          ) : !isEligible ? (
            <div className="w-full">
              <Button className="w-full bg-gray-100 text-gray-500" variant="outline" disabled>
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
                  className="w-full text-white"
                  style={{ backgroundColor: 'rgb(37,99,235)' }}
                  onClick={() => handlePlanSelect(plan)}
                  disabled={!isKycVerified}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
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
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Header title="Subscription Plans" />

        {/* Hero Section */}
        <div className="mt-8 mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">
            Choose Your Plan
          </h1>
          <p className="text-gray-600 text-sm">
            Unlock exclusive features to grow your store faster
          </p>
        </div>

        {/* KYC Verification Alert */}
        {!checkingKyc && !isKycVerified && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">
                  KYC Verification Required
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  You must complete KYC verification before subscribing to any plan.
                </p>
                <button
                  onClick={() => router.push("/kyc")}
                  className="text-sm font-medium text-red-900 underline hover:text-red-700"
                >
                  Complete KYC now →
                </button>
              </div>
            </div>
          </div>
        )}

        {!subLoading && limits && (
          <div className="bg-gradient-to-br from-blue-50 to-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5" style={{ color: 'rgb(37,99,235)' }} />
              Your Current Limits
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Products</p>
                <p className="text-2xl font-bold text-gray-900">
                  {limits.maxProducts === 9999 ? "∞" : limits.maxProducts}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Services</p>
                <p className="text-2xl font-bold text-gray-900">
                  {limits.maxServices === 9999 ? "∞" : limits.maxServices}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Product VIP</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(37,99,235)' }}>
                  {limits.vipTagsProduct || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Service VIP</p>
                <p className="text-2xl font-bold" style={{ color: 'rgb(37,99,235)' }}>
                  {limits.vipTagsService || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="product"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              Products
            </TabsTrigger>
            <TabsTrigger 
              value="service"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              Services
            </TabsTrigger>
            <TabsTrigger 
              value="bundle"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              Bundles
            </TabsTrigger>
            <TabsTrigger 
              value="boost"
              className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              Boosts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="product">
            {loadingDbPlans ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading plans...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {dbPlans
                  .filter(plan => plan.category === "product")
                  .sort((a, b) => {
                    // Maintenance plans (₦700) go last
                    if (a.type === "maintenance") return 1;
                    if (b.type === "maintenance") return -1;
                    // Free plans go first
                    if (a.price === 0) return -1;
                    if (b.price === 0) return 1;
                    // Sort by price for the rest
                    return a.price - b.price;
                  })
                  .map((plan) => renderPlanCard(plan))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="service">
            {loadingDbPlans ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading plans...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {dbPlans
                  .filter(plan => plan.category === "service")
                  .sort((a, b) => {
                    // Maintenance plans (₦700) go last
                    if (a.type === "maintenance") return 1;
                    if (b.type === "maintenance") return -1;
                    // Free plans go first
                    if (a.price === 0) return -1;
                    if (b.price === 0) return 1;
                    // Sort by price for the rest
                    return a.price - b.price;
                  })
                  .map((plan) => renderPlanCard(plan))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bundle">
            {loadingDbPlans ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading plans...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {dbPlans.filter(plan => plan.category === "bundle").map((plan) => renderPlanCard(plan))}
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: 'rgb(37,99,235)' }} />
                    Save More with Longer Plans
                  </h4>
                  <p className="text-sm text-gray-600">
                    Monthly Bundle: ₦2,500/month • Quarterly: ₦3,000 (save ₦4,500) • Yearly: ₦10,000 (save ₦20,000)
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="boost">
            {loadingDbPlans ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading plans...</p>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    Boost Your Visibility
                  </h4>
                  <p className="text-sm text-gray-600">
                    One-time boosts give your products/services maximum exposure for 7 days. Perfect for special promotions or new launches!
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {dbPlans.filter(plan => plan.category === "boost").map((plan) => renderPlanCard(plan))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-12 max-w-3xl mx-auto w-full">
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[rgb(37,99,235)]" strokeWidth={2} />
              <h3 className="text-lg font-semibold text-gray-900">
                Frequently Asked Questions
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm mb-1">
                    Can I upgrade my plan anytime?
                  </p>
                  <p className="text-sm text-gray-600">
                    Yes! You can upgrade at any time. Your new benefits will be active immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm mb-1">
                    What happens when my subscription expires?
                  </p>
                  <p className="text-sm text-gray-600">
                    You'll automatically return to the free plan. Your listings will remain but with limited features.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-1.5 h-1.5 bg-[rgb(37,99,235)] rounded-full mt-2"></div>
                <div>
                  <p className="font-medium text-gray-900 text-sm mb-1">
                    What is a Maintenance plan?
                  </p>
                  <p className="text-sm text-gray-600">
                    After 3 paid months, you can switch to a maintenance plan at ₦700/month to keep your content active without premium features.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
