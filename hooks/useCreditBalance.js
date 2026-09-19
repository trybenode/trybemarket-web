import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Real-time hook for a user's App Credit balance.
 * See 01-app-credit-system.md — balance is a cached field on users/{uid},
 * server-written only (earn/spend triggers write it, never the client).
 */
export function useCreditBalance(userId) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setBalance(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, "users", userId),
      (docSnap) => {
        setBalance(docSnap.exists() ? docSnap.data().creditBalance || 0 : 0);
        setLoading(false);
      },
      (err) => {
        console.error("Credit balance snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { balance, loading, error };
}
