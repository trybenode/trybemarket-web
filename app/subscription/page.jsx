"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

// import { PaystackButton } from "react-paystack";
import dynamic from "next/dynamic";

import toast from "react-hot-toast";
import BackButton from "@/components/BackButton";
import UserProfile from "@/components/UserProfile";

const PaystackWrapper = dynamic(() => import("@/components/PaystackWrapper"), {
  ssr: false,
});
export default function SubscriptionPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [isVerified, setIsVerified] = useState(true); // placeholder for KYC status
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [reference, setReference] = useState(null);

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_KEY;


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setReference(`${currentUser.uid}-${Date.now()}`);
      }
      setLoadingUser(false); // <- Set to false regardless
    });

    return () => unsubscribe();
  }, []);

  const getFutureDate = (daysToAdd) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date;
  };
  const plan = {
    id: "Premium",
    name: "Premium Trybe",
    features: [
      "Featured badge",
      "Sharable Shop link",
      "Unlimited posts",
      "Priority search",
      "3 boosted product",
    ],
    amountInKobo: 150000,
  };

  // useEffect(() => {
  //   const fetchUserData = async () => {
  //     const user = auth.currentUser;
  //     if (!user) return;
  //     const docRef = doc(db, "users", user.uid);
  //     const docSnap = await getDoc(docRef);
  //     if (docSnap.exists()) {
  //       const userData = docSnap.data();
  //       setCurrentPlan(userData.subscriptionPlan);
  //       setIsVerified(userData.kycVerified);
  //     }
  //   };
  //   fetchUserData();
  // }, []);
  useEffect(() => {
    const fetchSubscription = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const subRef = doc(db, "subscriptions", user.uid);
        const subSnap = await getDoc(subRef);

        if (subSnap.exists()) {
          const subData = subSnap.data();
          if (subData.isActive) {
            setCurrentPlan(subData.planId);
          }
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      }
    };

    fetchSubscription();
  }, []);

  const componentProps = {
    email: user?.email,
    amount: plan.amountInKobo,
    reference,
    metadata: {
      userId: user?.uid,
      planId: plan.id,
      planName: plan.name,
    },
    publicKey,
    text: "Pay Now",
    onSuccess: async (response) => {
      alert("Thanks for doing business with us! Come back soon!!");
      toast.success(
        "Your Subscription is active! You've unlocked the premium Trybe experience"
      );
      const user = auth.currentUser;
      if (!user) return;
      setLoading(true);
      const subRef = doc(db, "subscriptions", user.uid);

      await setDoc(
        subRef,
        {
          planId: plan.id,

          amount: plan.amountInKobo,
          orderNo: response.reference,
          subscribedAt: serverTimestamp(),
          expiryDate: getFutureDate(plan.id === "Premium" ? 30 : 7),
          isActive: true,
          features: plan.features,
          uploadStats: { uploadCount: 0, lastReset: serverTimestamp() },
        },
        { merge: true }
      );
      // await updateSubscription(planId, ref)
      setCurrentPlan(plan.id);
      setLoading(false);
      // setCurrentPlan(planId);
      router.push("/thank-you");
    },
    // onClose: () => alert("Wait! Don't leave :("),
    onClose: () => toast.error("Payment was cancelled"),
  };
  return (
    <div className=" bg-white min-h-screen py-4 justify-center flex ">
      <div className="">
        <div className="flex flex-row justify-between items-center">
          {" "}
          <BackButton /> <h4> Subscriptions</h4> <UserProfile />
        </div>

        <p className="text-center text-gray-500 mb-6">
          Unlock exclusive features to grow your store faster.
        </p>

        <div className="bg-yello-50 p-4 rounded-lg border border-yellow-100 mb-4">
          <h2 className="text-lg text-center font-semibold text-blue-700">
            {plan.name}
          </h2>
          <p className="text-gray-700 mt-1">₦1,500 / 30 days</p>
          <ul className="mt-3 list-disc list-inside text-sm text-gray-600 space-y-1">
            {plan.features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
        </div>

        {currentPlan === plan.id ? (
          <div className="mt-4 text-center">
            <p className="text-green-600 font-semibold">
              ✅ You’re already subscribed to Premium
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Your benefits are active. Thank you!
            </p>
          </div>
        ) : (
          <div className="mt-4">
            {/* <PaystackButton
              {...componentProps}
              className={`w-full py-2 rounded-lg text-white text-center font-medium ${
                loading
                  ? "bg-blue-400 cursor-not-allowed animate-pulse"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={loading}
            /> */}
            {loadingUser ? (
              <div className="text-center text-sm text-gray-500">
                Checking user status...
              </div>
            ) : user?.email && reference && publicKey ? (
              <PaystackWrapper props={componentProps} loading={loading} />
            ) : (
              <div className="text-center text-sm text-red-500">
                Missing payment info. Please reload or contact support.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

{
  /* {user && publicKey ? (
  <PaystackButton
    {...componentProps}
    className={`w-full py-2 rounded-lg text-white text-center font-medium ${
      loading
        ? "bg-blue-400 cursor-not-allowed animate-pulse"
        : "bg-blue-600 hover:bg-blue-700"
    }`}
    disabled={loading}
  />
) : (
  <div className="text-center text-sm text-red-500">
    You've already subscribed
  </div>
)} */
}
