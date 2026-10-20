"use client";

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, AlertCircle, BadgeCheck, Coins, Lock, Camera, Clock, Loader2, IdCard, GraduationCap, Monitor, BookOpen,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import DocumentGuide from "@/components/kyc/DocumentGuide";
import SelfieCapture from "@/components/kyc/SelfieCapture";
import {
  isFullyVerified,
  isKycCheckRunning,
  isProvisionalActive,
  isProvisionalExpired,
  toMillis,
  KYC_CHECK_STALE_MS,
} from "@/lib/kycAccess";
import { acceptPickedPhoto, pickFile, reportKycClientError, uploadKycPhoto } from "@/lib/kycClientUpload";

const MATRIC_CONFLICT_MESSAGE =
  "This matric number is already linked to another verified account. If you believe this is a mistake, please contact support.";
const NOT_ELIGIBLE_MESSAGE =
  "The fresher route is for 100 and 200 level students. Verify with your student ID card instead — it takes a minute.";

const ID_CARD = "id_card";
const FRESHER = "fresher_document";
const PORTAL = "portal_screenshot";
const LIBRARY = "library_card";

const formatDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function KycPage() {
  const router = useRouter();
  const { currentUser } = useUser() || {};

  const [track, setTrack] = useState(null);
  const [documentType, setDocumentType] = useState(PORTAL);
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [tempMatric, setTempMatric] = useState("");
  const [libraryCardNumber, setLibraryCardNumber] = useState("");
  const [photos, setPhotos] = useState({ front: null, back: null, selfie: null });
  const [previews, setPreviews] = useState({ front: null, back: null });
  const [selfieSource, setSelfieSource] = useState(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { message, icon, action? }

  // The student's own request, live — it's written only by the server, which
  // runs the automatic check and records the outcome here.
  const [kycRequest, setKycRequest] = useState(null);
  const [, setClock] = useState(0);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    return onSnapshot(
      doc(db, "kycRequests", currentUser.uid),
      (snap) => setKycRequest(snap.exists() ? snap.data() : null),
      (error) => console.error("Error loading your KYC request:", error)
    );
  }, [currentUser?.uid]);

  // A running check that never reports back becomes "under review" once it's
  // stale; re-render then so the page doesn't keep saying "checking".
  const checkRunning = isKycCheckRunning(kycRequest);
  useEffect(() => {
    if (!checkRunning) return undefined;
    const msLeft = kycRequest.autoCheck.startedAtMs + KYC_CHECK_STALE_MS - Date.now();
    const timer = setTimeout(() => setClock((n) => n + 1), Math.max(msLeft, 0) + 1000);
    return () => clearTimeout(timer);
  }, [checkRunning, kycRequest]);

  useEffect(
    () => () => Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url)),
    [previews]
  );

  const fullyVerified = isFullyVerified(currentUser);
  const provisionalActive = isProvisionalActive(currentUser);
  const provisionalExpired = isProvisionalExpired(currentUser);
  const isProvisional = provisionalActive || provisionalExpired;
  const deadline = formatDate(toMillis(currentUser?.provisionalExpiresAt));
  // A provisional student can only upgrade with a student ID.
  const activeTrack = isProvisional ? ID_CARD : track;

  const resetPhotos = () => {
    setPhotos({ front: null, back: null, selfie: null });
    setPreviews({ front: null, back: null });
    setSelfieSource(null);
  };

  const chooseTrack = (next) => {
    setTrack(next);
    resetPhotos();
  };

  const pickPhoto = async (slot) => {
    const file = await pickFile();
    if (!file) return;
    try {
      const photo = await acceptPickedPhoto(file);
      setPhotos((p) => ({ ...p, [slot]: photo }));
      setPreviews((p) => ({ ...p, [slot]: URL.createObjectURL(photo) }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Which photos this submission needs.
  const neededSlots =
    activeTrack === ID_CARD ? ["front", "back"] : documentType === PORTAL ? ["front", "selfie"] : ["front", "back", "selfie"];
  const numberFilled =
    activeTrack === ID_CARD ? matricNumber.trim() : documentType === PORTAL ? tempMatric.trim() : libraryCardNumber.trim();
  const ready =
    fullName.trim() &&
    numberFilled &&
    neededSlots.every((slot) => photos[slot]) &&
    (activeTrack === ID_CARD || consent);

  const handleSubmit = async () => {
    if (!ready) {
      toast.error("Please complete every field.");
      return;
    }
    setLoading(true);
    // Which step is running, so a failure says where it happened.
    let step = "checking your account";
    const files = neededSlots.map((slot) => photos[slot]);

    try {
      const user = getAuth().currentUser;
      if (!user) {
        toast.error("Please log in to submit KYC.");
        router.push("/login");
        return;
      }

      const uploaded = {};
      for (const slot of neededSlots) {
        step = { front: "uploading the front photo", back: "uploading the back photo", selfie: "uploading your selfie" }[slot];
        uploaded[slot] = await uploadKycPhoto(photos[slot], slot);
      }

      step = "sending your request for verification";
      const body =
        activeTrack === ID_CARD
          ? { track: ID_CARD, fullName, matricNumber, photos: uploaded }
          : {
              track: FRESHER,
              documentType,
              fullName,
              ...(documentType === PORTAL ? { tempMatric } : { libraryCardNumber }),
              photos: uploaded,
              selfieSource,
            };
      const idToken = await user.getIdToken();
      const response = await fetch("/api/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // The server's message says what to fix (name, number, already verified…).
        toast.error(data.error || "Failed to submit KYC, please try again.", { duration: 8000 });
        return;
      }

      if (data.status === "verified") {
        setModal({ icon: "success", message: "You're verified! Your Verified Student badge and 150 App Credit have been added to your account." });
      } else if (data.status === "provisional") {
        setModal({ icon: "success", message: "You're provisionally verified! You can now list and subscribe. Submit your student ID card within a year to complete your verification." });
      } else if (data.rejectionReason === "not_eligible") {
        setModal({ icon: "caution", message: NOT_ELIGIBLE_MESSAGE, action: "use_id_card" });
      } else if (data.rejectionReason === "matric_already_used") {
        setModal({ icon: "caution", message: MATRIC_CONFLICT_MESSAGE });
      } else if (data.status === "pending") {
        setModal({ icon: "caution", message: "Thanks! Our team will review your documents and email you as soon as it's done." });
      } else {
        setModal({ icon: "success", message: "Your KYC request has been updated." });
      }
    } catch (error) {
      console.error(`Error in handleSubmit (${step}):`, error);
      reportKycClientError(step, error, files);
      toast.error(`Failed while ${step}: ${error?.message || "unknown error"}. Please try again.`, { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  // Not eligible for the fresher route: straight to the ID-card form, keeping the name.
  const switchToIdCard = () => {
    setModal(null);
    chooseTrack(ID_CARD);
  };

  // One photo tile: dashed and tappable until a photo is chosen, then shows it.
  const photoTile = (slot, label, hint) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => pickPhoto(slot)}
        disabled={loading}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
          photos[slot] ? "border-emerald-300 bg-emerald-50/50" : "border-dashed border-slate-300 bg-white hover:border-primary/50 hover:bg-blue-50/40"
        }`}
      >
        {previews[slot] ? (
          <img src={previews[slot]} alt={`${label} preview`} className="h-16 w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Camera className="h-6 w-6" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            {photos[slot] ? "Photo selected — tap to change" : "Tap to choose a photo"}
          </span>
          <span className="block text-xs text-slate-500">{hint}</span>
        </span>
      </button>
    </div>
  );

  const textField = (id, label, value, setValue, placeholder, props = {}) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} disabled={loading} className="h-11" {...props} />
    </div>
  );

  const choiceButton = (selected, onClick, Icon, title, subtitle) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-primary bg-blue-50" : "border-slate-200 bg-white hover:border-primary/50"
      }`}
    >
      <Icon className="h-6 w-6 shrink-0 text-primary" />
      <span>
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
    </button>
  );

  const statusCard = () => {
    if (checkRunning) {
      return (
        <Banner tone="blue" Icon={Loader2} spin title="Checking your documents…">
          This usually takes under a minute.
        </Banner>
      );
    }
    if (provisionalActive) {
      return (
        <Banner tone="blue" Icon={GraduationCap} title={`You're provisionally verified until ${deadline}`}>
          Upgrade with your student ID card as soon as you get it — you'll get the Verified Student badge and 150 App
          Credit. If you don't by {deadline}, your listings will become unavailable, your plan will be paused and you
          may lose your subscription.
        </Banner>
      );
    }
    if (provisionalExpired) {
      return (
        <Banner tone="red" Icon={AlertCircle} title={`Your provisional verification ended on ${deadline}`}>
          Submit your student ID card to make your listings available again and resume your plan.
        </Banner>
      );
    }
    if (kycRequest?.status === "pending") {
      return (
        <Banner tone="amber" Icon={Clock} title="Your request is being reviewed">
          Our team will email you when it's done. Made a mistake? You can submit again below.
        </Banner>
      );
    }
    if (kycRequest?.status === "rejected") {
      if (kycRequest.rejectionReason === "not_eligible") {
        return (
          <Banner tone="amber" Icon={IdCard} title="Use your student ID card instead">
            {NOT_ELIGIBLE_MESSAGE}
          </Banner>
        );
      }
      return (
        <Banner tone="red" Icon={AlertCircle} title="Your last request wasn't approved">
          {kycRequest.rejectionReason === "matric_already_used"
            ? MATRIC_CONFLICT_MESSAGE
            : kycRequest.rejectionReason || "Check your details and photos, then submit again below."}
        </Banner>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header title="KYC Registration" />
      <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {fullyVerified ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <BadgeCheck className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">You're already verified</h2>
            <p className="mt-1 text-sm text-slate-600">Nothing more to do here — your Verified Student badge is on your profile.</p>
            <Button className="mt-5" onClick={() => router.push("/")}>Back to marketplace</Button>
          </div>
        ) : (
          <>
            {!isProvisional && (
              <div className="rounded-3xl border border-brand-yellow-deep/40 bg-gradient-to-br from-brand-yellow-soft to-white p-5">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">Verify you're a student</h2>
                <p className="mt-1 text-sm text-slate-600">It takes a minute and unlocks more on TrybeMarket.</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" /> A Verified Student badge on your profile</li>
                  <li className="flex items-center gap-2"><Coins className="h-4 w-4 shrink-0 text-amber-600" /> 150 App Credit when you're verified with your ID</li>
                  <li className="flex items-center gap-2"><Lock className="h-4 w-4 shrink-0 text-primary" /> Required to sell and to subscribe to a plan</li>
                </ul>
              </div>
            )}

            {statusCard()}

            {!checkRunning && (
              <>
                {!isProvisional && (
                  <div className="space-y-2">
                    {choiceButton(track === ID_CARD, () => chooseTrack(ID_CARD), IdCard, "I have my student ID card", "Usually verified in under a minute")}
                    {choiceButton(track === FRESHER, () => chooseTrack(FRESHER), GraduationCap, "I'm a fresher and don't have my ID yet", "100 or 200 level — use your portal or library card")}
                  </div>
                )}

                {activeTrack && (
                  <div className="space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    {isProvisional && <h3 className="font-bold text-slate-900">Upgrade with your student ID card</h3>}

                    {activeTrack === FRESHER && (
                      <div className="space-y-2">
                        <Label>Which document do you have?</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {choiceButton(documentType === PORTAL, () => { setDocumentType(PORTAL); resetPhotos(); }, Monitor, "Portal screenshot", "From portal.lcu.edu.ng")}
                          {choiceButton(documentType === LIBRARY, () => { setDocumentType(LIBRARY); resetPhotos(); }, BookOpen, "Library card", "Front and back")}
                        </div>
                      </div>
                    )}

                    {textField("fullName", "Full name", fullName, setFullName, "As shown on your document")}
                    {activeTrack === ID_CARD &&
                      textField("matricNumber", "Matric number", matricNumber, setMatricNumber, "e.g. LCU/UG/XX/XXXXX")}
                    {activeTrack === FRESHER && documentType === PORTAL &&
                      textField("tempMatric", "Matriculation number (7 digits)", tempMatric, setTempMatric, "e.g. 2601234", { inputMode: "numeric", maxLength: 7 })}
                    {activeTrack === FRESHER && documentType === LIBRARY &&
                      textField("libraryCardNumber", "Library Card No", libraryCardNumber, setLibraryCardNumber, "The number on the front of the card", { inputMode: "numeric", maxLength: 8 })}

                    <DocumentGuide documentType={activeTrack === ID_CARD ? "student_id" : documentType} />

                    {activeTrack === ID_CARD && (
                      <>
                        {photoTile("front", "Front of ID card", "JPEG, PNG or GIF, up to 5MB")}
                        {photoTile("back", "Back of ID card", "JPEG, PNG or GIF, up to 5MB")}
                      </>
                    )}
                    {activeTrack === FRESHER && documentType === PORTAL &&
                      photoTile("front", "Portal screenshot", "The whole screen, with the address bar")}
                    {activeTrack === FRESHER && documentType === LIBRARY && (
                      <>
                        {photoTile("front", "Front of library card", "Lead City University, University Librarian, Card No")}
                        {photoTile("back", "Back of library card", "The printed line, Surname and Year of Entry")}
                      </>
                    )}

                    {activeTrack === FRESHER && (
                      <div className="space-y-2">
                        <Label>Selfie</Label>
                        <SelfieCapture
                          value={photos.selfie}
                          disabled={loading}
                          onChange={(file, source) => {
                            setPhotos((p) => ({ ...p, selfie: file }));
                            setSelfieSource(source);
                          }}
                        />
                      </div>
                    )}

                    {activeTrack === FRESHER ? (
                      <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-600">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          disabled={loading}
                          className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <span>
                          I agree that TrybeMarket keeps my document photos and selfie to confirm I'm a Lead City
                          University student, and to trace an account if a dispute or abuse case comes up. They're stored
                          privately for as long as my account exists and any dispute needs them; only the verification
                          team can view them, and every view is logged. To ask for deletion, email{" "}
                          <a href="mailto:contact@trybemarket.online" className="underline">contact@trybemarket.online</a>.
                        </span>
                      </label>
                    ) : (
                      <p className="text-xs leading-relaxed text-slate-500">
                        Use a clear, well-lit photo where your name and matric number are easy to read.
                      </p>
                    )}

                    <Button size="lg" onClick={handleSubmit} loading={loading} disabled={!ready} className="w-full">
                      {loading ? "Submitting…" : isProvisional ? "Submit my student ID" : "Submit for verification"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <div className="flex justify-center">
              {modal.icon === "success" ? (
                <CheckCircle className="h-12 w-12 text-emerald-500" />
              ) : (
                <AlertCircle className="h-12 w-12 text-amber-500" />
              )}
            </div>
            <p className="mt-3 text-slate-700">{modal.message}</p>
            {modal.action === "use_id_card" ? (
              <Button size="lg" className="mt-5 w-full" onClick={switchToIdCard}>
                Use my student ID card
              </Button>
            ) : (
              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={() => {
                  setModal(null);
                  router.back();
                }}
              >
                Close
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const BANNER_TONES = {
  blue: "border-blue-200 bg-blue-50 text-primary",
  amber: "border-amber-200 bg-amber-50 text-amber-600",
  red: "border-red-200 bg-red-50 text-red-600",
};

function Banner({ tone, Icon, spin = false, title, children }) {
  return (
    <div className={`flex gap-3 rounded-3xl border p-5 ${BANNER_TONES[tone]}`}>
      <Icon className={`h-5 w-5 shrink-0 ${spin ? "animate-spin" : ""}`} />
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{children}</p>
      </div>
    </div>
  );
}
