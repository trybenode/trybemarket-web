"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";

const ThankYouPage = () => {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  // Countdown timer
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  // Navigate when countdown reaches 0
  useEffect(() => {
    if (countdown === 0) {
      router.push("/");
    }
  }, [countdown, router]);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Header title="Payment successful" />

      <div className="mx-auto max-w-md px-4 pt-10">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm sm:p-8">
          {/* Success mark */}
          <div className="relative mx-auto mb-6 h-20 w-20">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-200/70 motion-reduce:animate-none" aria-hidden />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
              <Check className="h-10 w-10" strokeWidth={3} />
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Thank you!</h1>
          <p className="mt-2 text-base text-slate-600">Your subscription has been activated successfully.</p>
          <p className="mt-1 text-sm text-slate-500">You now have access to all premium features.</p>

          <div className="mt-7 space-y-2.5">
            <Button size="lg" className="w-full" onClick={() => router.push("/my-shop")}>
              View my shop
              <ArrowRight />
            </Button>
            <Button size="lg" variant="soft" className="w-full" onClick={() => router.push("/product-upload")}>
              Upload a product
            </Button>
            <Button size="lg" variant="ghost" className="w-full text-slate-600" onClick={() => router.push("/")}>
              Go to homepage
            </Button>
          </div>

          <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500" role="status">
            Taking you to the homepage in{" "}
            <span className="font-semibold tabular-nums text-slate-900">{countdown}</span>s
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Need help?{" "}
          <a href="mailto:contact@trybemarket.online" className="font-semibold text-primary hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
};

export default ThankYouPage;
