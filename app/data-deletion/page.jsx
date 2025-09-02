"use client";
import React, { useState } from "react";
import Header from "@/components/Header";

export default function page() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Submitting .....");
    setSuccess(false);

    try {
      const res = await fetch("/api/data-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

        const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setStatus(data.message);
        setEmail("");
      } else {
        setStatus(data.error || " Error submitting request. Try again.");
      }
    } catch (err) {
      setStatus(" Network error. Try again.");
    }
  };
  return (
    <div className="min-h-screen  items-center justify-center bg-gray-100 p-6">
      <Header title={"Delete Data"} />
      <div className="w-full justify-center items-center flex flex-col  bg-white rounded-2xl shadow-md p-8">
        <p className="text-gray-600 mb-6">
          You have the right to permanently delete your TrybeMarket account and
          all associated data. Fill in your details below to request deletion.
        </p>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex flex-col justify-center items-center"
        >
          <input
            type="email"
            placeholder="Your registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {/* <input
            type="text"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          /> */}
          <button
            type="submit"
            className="w-10/12 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
          >
            Submit Request
          </button>
        </form>
        {status && (
          <p
            className={`mt-4 text-sm text-center ${
              success ? "text-green-600" : "text-red-600"
            }`}
          >
            {status}
          </p>
        )}
        <p className="text-xs text-center text-gray-500 mt-6">
          ⚠️ Once verified, all your account data, listings, and transactions
          will be deleted within 30 days.
        </p>
      </div>
    </div>
  );
}
