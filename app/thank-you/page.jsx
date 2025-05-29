'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import BackButton from "@/components/BackButton";
import UserProfile from "@/components/UserProfile";

const ThankYouPage = () => {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/'); 
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex justify-center ">
         <div className="flex flex-row justify-between items-center">
                  {" "}
                  <BackButton /> <h4> Subscriptions</h4> <UserProfile />
                </div>
      <div className=" items-center p-8 max-w-md w-full text-center">
        <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Subscription Successful!</h1>
        <p className="text-gray-600 mb-4">
          Thank you for subscribing. Your benefits have been unlocked!
        </p>
        <p className="text-sm text-gray-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default ThankYouPage;
