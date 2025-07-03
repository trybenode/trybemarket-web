'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import Header from "@/components/Header";


const ThankYouPage = () => {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/'); 
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen py-4 flex justify-center ">
         <Header title={"Thank You"}/>
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
