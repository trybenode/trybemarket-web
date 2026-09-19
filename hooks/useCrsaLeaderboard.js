import { useState, useEffect, useCallback } from "react";
import { auth } from "@/lib/firebase";

/**
 * Fetches GET /api/crsa/leaderboard (admins and ACTIVE CRSA members only —
 * the server returns 403 to anyone else, which surfaces here as `forbidden`).
 * Admins get every member with uid/code/active; members get only active
 * members' names and counts. See lib/crsaServer.js's getLeaderboard.
 */
export function useCrsaLeaderboard(userId) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const idToken = await user.getIdToken();
      const res = await fetch("/api/crsa/leaderboard", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 403) {
        setForbidden(true);
        setLeaderboard([]);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load the leaderboard");
      setForbidden(false);
      setIsAdmin(!!data.isAdmin);
      setLeaderboard(data.leaderboard);
    } catch (err) {
      console.error("CRSA leaderboard fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    load();
  }, [userId, load]);

  return { leaderboard, isAdmin, loading, forbidden, error, refresh: load };
}
