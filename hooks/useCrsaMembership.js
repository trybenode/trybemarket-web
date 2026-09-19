import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Real-time read of the signed-in user's OWN CRSA membership + stats, via the
 * client SDK — allowed by firestore.rules' owner-read rule on crsaMembers/{uid}
 * and crsaStats/{uid} (both are server-written only; clients can never
 * write them). Same shape as hooks/useCreditBalance.js.
 *
 * `member` is null for anyone who isn't a member. Snapshot errors (e.g. rules
 * not yet published) are swallowed into `member: null` — a non-member view is
 * the safe default, since this only gates showing an extra card.
 */
export function useCrsaMembership(userId) {
  const [member, setMember] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setMember(null);
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let memberReady = false;
    const finish = () => memberReady && setLoading(false);

    const unsubMember = onSnapshot(
      doc(db, "crsaMembers", userId),
      (snap) => {
        setMember(snap.exists() ? snap.data() : null);
        memberReady = true;
        finish();
      },
      () => {
        setMember(null);
        memberReady = true;
        finish();
      }
    );
    const unsubStats = onSnapshot(
      doc(db, "crsaStats", userId),
      (snap) => setStats(snap.exists() ? snap.data() : null),
      () => setStats(null)
    );

    return () => {
      unsubMember();
      unsubStats();
    };
  }, [userId]);

  return { member, stats, loading };
}
