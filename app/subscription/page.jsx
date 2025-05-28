'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePaystackPayment } from 'react-paystack';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {  db } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import BackButton from '@/components/BackButton'
import 'react-toastify/dist/ReactToastify.css';
import UserProfile from '@/components/UserProfile';

const plans = [
  { id: 'Free', name: 'Free Plan', amountInKobo: null, description: 'Basic access. Limited features.', features: ['Post up to 5 products', 'View listings', 'Limited reach'] },
  { id: 'Premium', name: '🎟️ Premium Plan', amountInKobo: 150000, description: 'Unlimited listings & boost visibility.', features: ['Featured badge', 'Priority search', 'Unlimited posts', '3 boosted products'] },
  { id: 'Boost', name: 'Product Boost', amountInKobo: 70000, description: 'Boost product to top for 7 days.', features: ['Top listing', 'Increased visibility', 'More sales'] },
  { id: 'Alumni', name: '🎓 Alumni Access', amountInKobo: 300000, description: 'Stay connected post-graduation.', features: ['Post products', 'Access network', 'Special alumni badge'] },
];

const getFutureDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const SubscribePage = () => {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(true);

  const auth = getAuth();

  // fetch subscription and user verification
  useEffect(() => {
    let isActive = true;
    const fetchData = async () => {

      setSubLoading(true);
      const user = auth.currentUser;
      if (!user) {
        // setIsVerified(true);
        // setCurrentPlan(null);
        setSubLoading(false);
        return;
      }
      try {
        const subSnap = await getDoc(doc(db, 'subscriptions', user.uid));
        if (subSnap.exists() && isActive) setCurrentPlan(subSnap.data().planId);

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if(isActive){
          const data = userSnap.exists() ? userSnap.data() : {isVerified: false};
          setIsVerified(data.isVerified ?? false);

        }else{
          setIsVerified(true)
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load subscription data');
      } finally {
         if (isActive) setSubLoading(false);
      }
    };
    fetchData();
  }, []);
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      fetchData(user);
    } else {
      setSubLoading(false);
    }
  });
  return () => unsubscribe();
}, []);
  const updateSubscription = async (plan, ref) => {
    const user = auth.currentUser;
    if (!user || !plan?.id) return;
    const subRef = doc(db, 'subscriptions', user.uid);
    await setDoc(subRef, {
      planId: plan.id,
      planName: plan.name,
      amount: plan.amountInKobo ? plan.amountInKobo / 100 : 0,
      orderNo: ref,
      subscribedAt: serverTimestamp(),
      expiryDate: getFutureDate(plan.id === 'Premium' ? 30 : 7),
      isActive: true,
      features: plan.features,
      uploadStats: { uploadCount: 0, lastReset: serverTimestamp() }
    }, { merge: true });
  };

  const handlePayment = (plan) => {
    if (!isVerified) {
      toast.info('Complete KYC verification first');
      return;
    }
    const user = auth.currentUser;
    if (!user?.email) return toast.error('No user email');

    const reference = `SUB_${Date.now()}`;
    const config = {
      reference,
      email: user.email,
      amount: plan.amountInKobo,
      publicKey: process.env.NEXT_PUBLIC_PAYSTACK_KEY,
    };

    const onSuccess = async (res) => {
      const paystackRef = res.reference;
      if (!paystackRef) {
        toast.error('No transaction reference');
        return;
      }
      try {
        await updateSubscription(plan, paystackRef);
        toast.success(`Subscribed to ${plan.name}`);
        setCurrentPlan(plan.id);
        router.push('/thank-you');
      } catch (e) {
        console.error(e);
        toast.error('Subscription update failed');
      }
    };

    const onClose = () => toast.info('Payment cancelled');

    const initializePayment = usePaystackPayment(config);
    initializePayment(onSuccess, onClose);
  };

  if (subLoading) return <div className="flex items-center justify-center h-screen"><span>Loading...</span></div>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className='flex flex-row justify-between items-center '>
        <BackButton/>
      <h2 className="text-2xl font-bold mb-4">Choose Your Plan</h2>
      <UserProfile/>
      </div>
      {plans.map(plan => {
        const isCurrent = plan.id === currentPlan;
        const btnText = isCurrent ? 'Current Plan' : ['Boost','Alumni'].includes(plan.id) ? 'Coming Soon' : 'Pay Now';
        const disabled = isCurrent || ['Boost','Alumni'].includes(plan.id);
        return (
          <div key={plan.id} className="border-yellow-500 border rounded-lg p-4 mb-6 shadow-sm">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-2">{plan.description}</p>
            {plan.amountInKobo != null && <p className="mt-2 font-bold">₦{plan.amountInKobo/100}</p>}
            <ul className="mt-2 list-disc list-inside">
              {plan.features.map((f,i)=><li key={i}>{f}</li>)}
            </ul>
            <button
              disabled={disabled}
              onClick={() => handlePayment(plan)}
              className={`mt-4 px-4 py-2 rounded ${disabled ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}
            >{btnText}</button>
          </div>
        );
      })}
      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default SubscribePage;
