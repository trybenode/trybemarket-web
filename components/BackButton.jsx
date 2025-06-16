"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackBtn() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={goBack}
      aria-label="Go back"
      className="flex items-center space-x-1 text-yellow-600 hover:text-yellow-800"
    >
      <ArrowLeft size={20} className="text-yellow-600 hover:text-yellow-800" />
      {/* <span>Go Back</span> */}
    </button>
  );
}
