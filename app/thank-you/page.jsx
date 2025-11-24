"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const ThankYouPage = () => {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

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
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Header title={"Payment Successful"} />
        
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="w-full max-w-md">
            {/* Success Icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative w-24 h-24 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="text-green-600 w-16 h-16" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Thank You!
              </h1>
              
              <p className="text-lg text-gray-600 mb-2">
                Your subscription has been activated successfully.
              </p>
              
              <p className="text-sm text-gray-500">
                You now have access to all premium features.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mb-8">
              <Button
                onClick={() => router.push("/my-shop")}
                className="w-full text-white shadow-sm py-6 text-base"
                style={{ backgroundColor: 'rgb(37,99,235)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(29,78,216)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(37,99,235)'}
              >
                View My Shop
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button
                onClick={() => router.push("/product-upload")}
                variant="outline"
                className="w-full border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 py-6 text-base"
              >
                Upload Product
              </Button>
              
              <Button
                onClick={() => router.push("/")}
                variant="ghost"
                className="w-full text-gray-600 hover:text-gray-900 hover:bg-gray-50 py-6 text-base"
              >
                Go to Homepage
              </Button>
            </div>

            {/* Countdown */}
            <div className="text-center pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Redirecting to homepage in{" "}
                <span className="font-semibold text-gray-900">{countdown}</span> seconds
              </p>
            </div>
          </div>
        </div>

        {/* Footer Help Text */}
        <div className="text-center pb-8">
          <p className="text-sm text-gray-500">
            Need help?{" "}
            <a 
              href="mailto:support@trybemarket.com" 
              className="font-medium hover:underline"
              style={{ color: 'rgb(37,99,235)' }}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThankYouPage;
