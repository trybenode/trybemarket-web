"use client";
import { PaystackButton } from "react-paystack";

export default function PaystackWrapper({ props, loading }) {
  if (!props || !props.email || !props.reference || !props.publicKey) {
    console.warn("Missing Paystack props:", props);
    return (
      <div className="text-center text-red-500 text-sm">
        Cannot load payment. Missing required details.
      </div>
    );
  }

  return (
    <PaystackButton
      {...props}
      className={`w-full py-2 rounded-lg text-white text-center font-medium ${
        loading
          ? "bg-blue-400 cursor-not-allowed animate-pulse"
          : "bg-blue-600 hover:bg-blue-700"
      }`}
      disabled={loading}
    />
  );
}
