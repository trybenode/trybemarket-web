import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserLimits, isSubscriptionActive, getPlanById } from "@/lib/subscriptionStore";

/**
 * Hook to manage user subscription state
 */
export function useSubscription(userId) {
  const [subscriptions, setSubscriptions] = useState(null);
  const [limits, setLimits] = useState({ 
    maxProducts: 3, 
    vipTagsProduct: 0, 
    maxServices: 1,
    vipTagsService: 0 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Real-time listener for subscription changes
    const unsubscribe = onSnapshot(
      doc(db, "subscriptions", userId),
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSubscriptions({
              product: data.product || { planId: "product_free", isActive: true },
              service: data.service || { planId: "service_free", isActive: true },
              bundle: data.bundle || null,
            });
          } else {
            // Default free plans
            setSubscriptions({
              product: { planId: "product_free", isActive: true },
              service: { planId: "service_free", isActive: true },
              bundle: null,
            });
          }

          // Fetch limits
          const userLimits = await getUserLimits(userId);
          setLimits(userLimits);
          setLoading(false);
        } catch (err) {
          console.error("Error in subscription listener:", err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error("Subscription snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  /**
   * Check if user has an active plan in a category
   */
  const hasActivePlan = useCallback(
    (category) => {
      if (!subscriptions) return false;
      
      // Check bundle first
      if (subscriptions.bundle && isSubscriptionActive(subscriptions.bundle)) {
        const bundlePlan = getPlanById(subscriptions.bundle.planId);
        if (bundlePlan?.category === "bundle") return true;
      }

      // Check specific category
      if (subscriptions[category]) {
        return isSubscriptionActive(subscriptions[category]);
      }

      return false;
    },
    [subscriptions]
  );

  /**
   * Get current plan for a category
   */
  const getCurrentPlan = useCallback(
    (category) => {
      if (!subscriptions) return null;

      // Check bundle
      if (subscriptions.bundle && isSubscriptionActive(subscriptions.bundle)) {
        return getPlanById(subscriptions.bundle.planId);
      }

      // Check category
      if (subscriptions[category] && isSubscriptionActive(subscriptions[category])) {
        return getPlanById(subscriptions[category].planId);
      }

      // Return free plan
      return getPlanById(`${category}_free`);
    },
    [subscriptions]
  );

  /**
   * Check if user has a specific feature
   */
  const hasFeature = useCallback(
    (feature) => {
      if (!subscriptions) return false;

      const checkPlanFeatures = (planData) => {
        if (!planData || !isSubscriptionActive(planData)) return false;
        const plan = getPlanById(planData.planId);
        return plan?.features?.some((f) =>
          f.toLowerCase().includes(feature.toLowerCase())
        );
      };

      // Check bundle
      if (checkPlanFeatures(subscriptions.bundle)) return true;

      // Check product and service plans
      if (checkPlanFeatures(subscriptions.product)) return true;
      if (checkPlanFeatures(subscriptions.service)) return true;

      return false;
    },
    [subscriptions]
  );

  /**
   * Check if user can upload more products/services
   */
  const canUpload = useCallback(
    (type, currentCount) => {
      if (type === "product") {
        return currentCount < limits.maxProducts;
      }
      if (type === "service") {
        return currentCount < limits.maxServices;
      }
      return false;
    },
    [limits]
  );

  return {
    subscriptions,
    limits,
    loading,
    error,
    hasActivePlan,
    getCurrentPlan,
    hasFeature,
    canUpload,
  };
}
