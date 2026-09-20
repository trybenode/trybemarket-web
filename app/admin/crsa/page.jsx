"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Copy, Users, UserPlus, ShieldAlert } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/context/UserContext";
import { auth, db } from "@/lib/firebase";
import { buildReferralLink } from "@/lib/crsaConstants";
import { useCrsaLeaderboard } from "@/hooks/useCrsaLeaderboard";

/**
 * Minimal admin tool for the CRSA program — the app has no other admin UI.
 * The admins/{uid} check below is UX only (it hides the page from everyone
 * else); the real gate is server-side: every action here calls an
 * /api/admin/crsa/* route that runs requireAdmin, and the leaderboard route
 * re-checks the caller itself.
 */
export default function AdminCrsaPage() {
  const router = useRouter();
  const { currentUser, loading: authLoading } = useUser();
  const [adminState, setAdminState] = useState("checking"); // checking | admin | denied
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyUid, setBusyUid] = useState(null);

  const { leaderboard, loading, error, refresh } = useCrsaLeaderboard(adminState === "admin" ? currentUser?.uid : null);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "admins", currentUser.uid))
      .then((snap) => !cancelled && setAdminState(snap.exists() ? "admin" : "denied"))
      .catch(() => !cancelled && setAdminState("denied"));
    return () => {
      cancelled = true;
    };
  }, [currentUser, authLoading, router]);

  const authedPost = async (path, body) => {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const data = await authedPost("/api/admin/crsa/members", { email });
      toast.success(
        data.created ? `Added — referral code ${data.referralCode}` : data.reactivated ? "Reactivated" : "Already an active member"
      );
      setEmail("");
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (row) => {
    setBusyUid(row.uid);
    try {
      await authedPost("/api/admin/crsa/members/status", { uid: row.uid, active: !row.active });
      toast.success(row.active ? "Deactivated" : "Reactivated");
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyUid(null);
    }
  };

  const copyLink = async (code) => {
    try {
      await navigator.clipboard.writeText(buildReferralLink(code, window.location.origin));
      toast.success("Referral link copied");
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  };

  if (authLoading || adminState === "checking") {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Header title="CRSA Admin" />
          <Skeleton className="h-40 w-full mt-6" />
        </div>
      </div>
    );
  }

  if (adminState === "denied") {
    return (
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Header title="CRSA Admin" />
          <div className="flex flex-col items-center py-20 text-center">
            <ShieldAlert className="h-10 w-10 text-gray-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Admins only</h3>
            <p className="text-sm text-gray-600 mt-1">You don&apos;t have access to this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Header title="CRSA Admin" />

        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mt-6 mb-6">
          <label htmlFor="crsa-email" className="text-sm font-medium text-gray-900 flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4" /> Add a Course Rep Student Ambassador
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="crsa-email"
              type="email"
              placeholder="Their TrybeMarket account email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={adding}
            />
            <Button type="submit" disabled={adding || !email.trim()} className="text-white bg-blue-600 hover:bg-blue-700">
              {adding ? "Adding..." : "Add member"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            They must already have an account. A unique referral link is generated automatically; re-adding a deactivated member restores their original code.
          </p>
        </form>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-medium text-gray-900">
            <Users className="h-4 w-4" /> Members &amp; leaderboard
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-600">No CRSA members yet — add the first one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2 w-12">#</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2 text-right">KYC</th>
                    <th className="px-4 py-2 text-right">Installs</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.uid} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-gray-500">{row.rank}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.fullName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.referralCode}</td>
                      <td className="px-4 py-3 text-right font-semibold">{row.kycCompletions}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.installs}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.active ? "success" : "outline"}>{row.active ? "Active" : "Inactive"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button variant="outline" size="sm" className="mr-2" onClick={() => copyLink(row.referralCode)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Link
                        </Button>
                        <Button variant="outline" size="sm" disabled={busyUid === row.uid} onClick={() => handleToggle(row)}>
                          {row.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
