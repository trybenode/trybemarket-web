"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, HandCoins } from "lucide-react";
import toast from "react-hot-toast";

// Mirrors lib/saleConfirmationServer.js's deriveRoles — legacy conversations
// (before buyerId/sellerId became explicit fields) only have `participants`
// + `product.sellerId`. Purely for display; the API derives roles itself
// server-side regardless of what this computes.
function deriveRoles(conversation) {
  const sellerId = conversation?.sellerId || conversation?.product?.sellerId || null;
  const buyerId =
    conversation?.buyerId ||
    (conversation?.participants || []).find((p) => p !== sellerId) ||
    null;
  return { buyerId, sellerId };
}

async function callSaleApi(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in");
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/sale/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Something went wrong");
  return data;
}

export default function SaleConfirmationPanel({ conversationId, conversation, currentUserId }) {
  const [busy, setBusy] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  if (!conversation || !currentUserId) return null;

  const { buyerId, sellerId } = deriveRoles(conversation);
  if (!buyerId || !sellerId || (currentUserId !== buyerId && currentUserId !== sellerId)) {
    return null;
  }

  const isBuyer = currentUserId === buyerId;
  const saleStatus = conversation.saleStatus || "none";
  const myConfirmedAt = isBuyer ? conversation.buyerConfirmedAt : conversation.sellerConfirmedAt;
  const iHaveConfirmed = !!myConfirmedAt;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      const result = await callSaleApi("confirm", { conversationId });
      if (result.saleStatus === "confirmed") {
        toast.success(
          result.creditAwarded
            ? "Sale confirmed! You've earned App Credit 🎉"
            : "Sale confirmed!",
          { duration: 4000 }
        );
      } else {
        toast.success("Confirmed — waiting on the other person now.");
      }
    } catch (error) {
      toast.error(error.message || "Failed to confirm sale");
    } finally {
      setBusy(false);
    }
  };

  const handleDispute = async () => {
    try {
      setBusy(true);
      await callSaleApi("dispute", { conversationId, reason: disputeReason.trim() || null });
      toast.success("Marked as disputed. Our team can review this conversation.");
      setShowDisputeForm(false);
      setDisputeReason("");
    } catch (error) {
      toast.error(error.message || "Failed to dispute sale");
    } finally {
      setBusy(false);
    }
  };

  if (saleStatus === "confirmed") {
    return (
      <Card className="mb-4 border-green-200 bg-green-50">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">Sale confirmed</p>
            <p className="text-xs text-green-700">Both sides confirmed this transaction.</p>
          </div>
          <Badge variant="success">Confirmed</Badge>
        </CardContent>
      </Card>
    );
  }

  if (saleStatus === "disputed") {
    return (
      <Card className="mb-4 border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">Sale disputed</p>
            <p className="text-xs text-orange-700">
              This is flagged for review. Contact support if you need help resolving it.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // saleStatus is "none" or "pending"
  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <HandCoins className="h-5 w-5 flex-shrink-0" style={{ color: "rgb(37,99,235)" }} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {iHaveConfirmed ? "Waiting for the other person to confirm" : "Did this sale happen?"}
            </p>
            <p className="text-xs text-gray-600">
              {iHaveConfirmed
                ? "Once they confirm too, this counts as a completed sale."
                : "Confirming here helps both of you earn App Credit once the other side agrees too."}
            </p>
          </div>
          {iHaveConfirmed && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Pending
            </Badge>
          )}
        </div>

        {!showDisputeForm ? (
          <div className="flex flex-wrap gap-2">
            {!iHaveConfirmed && (
              <Button
                size="sm"
                className="text-white"
                style={{ backgroundColor: "rgb(37,99,235)" }}
                disabled={busy}
                onClick={handleConfirm}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Confirm Sale
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setShowDisputeForm(true)}
            >
              Dispute
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              className="w-full text-sm border border-gray-300 rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="What happened? (optional)"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              disabled={busy}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={busy} onClick={handleDispute}>
                Submit Dispute
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setShowDisputeForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
