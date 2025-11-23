"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle, Sparkles, Crown, TrendingUp, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const ThankYouPage = () => {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 py-4">
      <Header title={"Thank You"} />
      
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="max-w-2xl w-full">
          {/* Success Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 text-center relative overflow-hidden">
            {/* Animated Background Elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-green-100 rounded-full -mr-20 -mt-20 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-100 rounded-full -ml-16 -mb-16 opacity-50"></div>
            
            {/* Success Icon with Animation */}
            <div className="relative z-10 mb-6">
              <div className="inline-block p-4 bg-green-100 rounded-full animate-bounce">
                <CheckCircle className="text-green-600 w-20 h-20" strokeWidth={2} />
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 relative z-10">
              🎉 Subscription Activated!
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 relative z-10">
              Thank you for upgrading! Your premium benefits are now active.
            </p>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-4 mb-8 relative z-10">
              <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <Sparkles className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-800 text-sm">Premium Features</p>
                <p className="text-xs text-gray-600 mt-1">Unlocked</p>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <Crown className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-800 text-sm">VIP Status</p>
                <p className="text-xs text-gray-600 mt-1">Active Now</p>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-800 text-sm">More Visibility</p>
                <p className="text-xs text-gray-600 mt-1">Boost Sales</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
              <Button
                onClick={() => router.push("/my-shop")}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 text-base"
              >
                View My Shop
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button
                onClick={() => router.push("/product-upload")}
                variant="outline"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-3 text-base"
              >
                Upload Products
              </Button>
            </div>

            {/* Countdown Timer */}
            <div className="mt-8 pt-6 border-t border-gray-200 relative z-10">
              <p className="text-sm text-gray-500">
                Redirecting to homepage in{" "}
                <span className="font-bold text-blue-600 text-lg">{countdown}</span>{" "}
                seconds...
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              Need help? Contact us at{" "}
              <a href="mailto:support@trybemarket.com" className="text-blue-600 hover:underline font-medium">
                support@trybemarket.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;
