"use client";

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertCircle, BadgeCheck, BookOpen, Camera, CheckCircle, ChevronLeft, ChevronRight, Clock, Coins, GraduationCap,
  IdCard, Loader2, Monitor, Store,
} from "lucide-react";
import { useUser } from "@/context/UserContext";
import useUserStore from "@/lib/userStore";
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

/**
 * /kyc — a short step-by-step flow, one thing per screen on a phone:
 *   start → details → photos (→ selfie, freshers only) → submit
 * The submit/upload logic is the same as before; only the layout changed.
 */
export default function KycPage() {
  const router = useRouter();
  const { currentUser } = useUser() || {};

  // A school comes first: automatic ID checks compare the card against it, and
  // campus promotions are given on verification (09-offers.md). Read from the
  // user store — the same source as the campus picker — so the two pages can't
  // disagree and bounce between each other; both it and the profile must say
  // "no school" before we redirect.
  const storeReady = useUserStore((s) => s.isInitialized);
  const storeError = useUserStore((s) => s.initError);
  const storeUniversity = useUserStore((s) => s.selectedUniversity);
  useEffect(() => {
    const store = useUserStore.getState();
    if (!store.isInitialized) store.loadUser();
  }, []);
  const needsSchool =
    Boolean(currentUser) && storeReady && !storeError && !storeUniversity && !currentUser.selectedUniversity;
  useEffect(() => {
    if (!needsSchool) return;
    toast("Choose your school first, then you'll come back here to verify.", { id: "kyc-needs-school" });
    router.replace("/select-university?next=/kyc");
  }, [needsSchool, router]);

  const [track, setTrack] = useState(null);
  const [step, setStep] = useState("start"); // start | details | photos | selfie
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

  // The student's own request, live — written only by the server.
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

  // A running check that never reports back becomes "under review" once stale.
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
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const fullyVerified = isFullyVerified(currentUser);
  const provisionalActive = isProvisionalActive(currentUser);
  const provisionalExpired = isProvisionalExpired(currentUser);
  const isProvisional = provisionalActive || provisionalExpired;
  const deadline = formatDate(toMillis(currentUser?.provisionalExpiresAt));

  const isFresher = track === FRESHER;
  const steps = isFresher ? ["details", "photos", "selfie"] : ["details", "photos"];
  const stepIndex = steps.indexOf(step);
  const neededSlots = !isFresher ? ["front", "back"] : documentType === PORTAL ? ["front", "selfie"] : ["front", "back", "selfie"];
  const number = !isFresher ? matricNumber : documentType === PORTAL ? tempMatric : libraryCardNumber;

  const resetPhotos = () => {
    setPhotos({ front: null, back: null, selfie: null });
    setPreviews({ front: null, back: null });
    setSelfieSource(null);
  };

  const start = (next) => {
    setTrack(next);
    resetPhotos();
    setStep("details");
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

  const stepReady = {
    details: fullName.trim().split(/\s+/).length >= 2 && number.trim().length > 0,
    photos: neededSlots.filter((s) => s !== "selfie").every((s) => photos[s]),
    selfie: !!photos.selfie && consent,
  }[step];
  const isLastStep = stepIndex === steps.length - 1;

  const goBack = () => (stepIndex <= 0 ? setStep("start") : setStep(steps[stepIndex - 1]));
  const goNext = () => (isLastStep ? handleSubmit() : setStep(steps[stepIndex + 1]));

  const handleSubmit = async () => {
    setLoading(true);
    let stage = "checking your account";
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
        stage = { front: "uploading the front photo", back: "uploading the back photo", selfie: "uploading your selfie" }[slot];
        uploaded[slot] = await uploadKycPhoto(photos[slot], slot);
      }
      stage = "sending your request for verification";
      const body = !isFresher
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
        toast.error(data.error || "Failed to submit KYC, please try again.", { duration: 8000 });
        return;
      }
      if (data.status === "verified") {
        setModal({ icon: "success", title: "You're verified", message: "Your Verified Student badge and 150 App Credit have been added." });
      } else if (data.status === "provisional") {
        setModal({ icon: "success", title: "You're provisionally verified", message: "You can now sell and subscribe. Submit your student ID within a year to complete verification." });
      } else if (data.rejectionReason === "not_eligible") {
        setModal({ icon: "caution", title: "Use your student ID", message: NOT_ELIGIBLE_MESSAGE, action: "use_id_card" });
      } else if (data.rejectionReason === "matric_already_used") {
        setModal({ icon: "caution", title: "Number already in use", message: MATRIC_CONFLICT_MESSAGE });
      } else if (data.status === "pending") {
        setModal({ icon: "pending", title: "Submitted", message: "Our team will review your documents and email you when it's done." });
      } else {
        setModal({ icon: "success", title: "Updated", message: "Your KYC request has been updated." });
      }
    } catch (error) {
      console.error(`Error in handleSubmit (${stage}):`, error);
      reportKycClientError(stage, error, files);
      toast.error(`Failed while ${stage}: ${error?.message || "unknown error"}. Please try again.`, { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  const switchToIdCard = () => {
    setModal(null);
    start(ID_CARD);
  };

  // ---------- pieces ----------

  const field = (id, label, value, setValue, placeholder, hint, props = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">{label}</label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        className="h-11 rounded-xl text-sm"
        {...props}
      />
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );

  const photoTile = (slot, label, hint) => (
    <button
      type="button"
      onClick={() => pickPhoto(slot)}
      disabled={loading}
      className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${
        photos[slot] ? "border-emerald-200 bg-emerald-50/60" : "border-dashed border-slate-300 bg-white hover:border-primary/50"
      }`}
    >
      {previews[slot] ? (
        <img src={previews[slot]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Camera className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block truncate text-[11px] text-slate-500">{photos[slot] ? "Added — tap to change" : hint}</span>
      </span>
      {photos[slot] && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />}
    </button>
  );

  const routeCard = (Icon, title, subtitle, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-primary/40 active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );

  const statusCard = () => {
    if (checkRunning) {
      return <Notice tone="blue" Icon={Loader2} spin title="Checking your documents…" text="This usually takes under a minute." />;
    }
    if (provisionalActive) {
      return (
        <Notice
          tone="blue"
          Icon={GraduationCap}
          title={`Provisionally verified until ${deadline}`}
          text={`Add your student ID when you get it to unlock the Verified badge and 150 App Credit. After ${deadline}, your listings become unavailable and your plan is paused — you may lose your subscription.`}
        />
      );
    }
    if (provisionalExpired) {
      return (
        <Notice
          tone="red"
          Icon={AlertCircle}
          title={`Provisional verification ended ${deadline}`}
          text="Submit your student ID to make your listings available again and resume your plan."
        />
      );
    }
    if (kycRequest?.status === "pending") {
      return <Notice tone="amber" Icon={Clock} title="Being reviewed" text="We'll email you when it's done. You can still submit again." />;
    }
    if (kycRequest?.status === "rejected") {
      if (kycRequest.rejectionReason === "not_eligible") {
        return <Notice tone="amber" Icon={IdCard} title="Use your student ID card instead" text={NOT_ELIGIBLE_MESSAGE} />;
      }
      return (
        <Notice
          tone="red"
          Icon={AlertCircle}
          title="Your last request wasn't approved"
          text={
            kycRequest.rejectionReason === "matric_already_used"
              ? MATRIC_CONFLICT_MESSAGE
              : kycRequest.rejectionReason || "Check your details and photos, then try again."
          }
        />
      );
    }
    return null;
  };

  const stepTitles = {
    details: isProvisional ? "Your student ID details" : isFresher ? "Your details" : "Your student ID details",
    photos: isFresher ? (documentType === PORTAL ? "Your portal screenshot" : "Your library card") : "Photos of your student ID",
    selfie: "A quick selfie",
  };
  const stepSubtitles = {
    details: "As they appear on your document.",
    photos: "Clear and readable — see the example.",
    selfie: "So our team can match you to your document.",
  };

  // ---------- screens ----------

  if (fullyVerified) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header title="Verification" />
        <div className="mx-auto max-w-md px-4 py-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <BadgeCheck className="h-7 w-7" />
          </span>
          <h2 className="mt-3 text-base font-bold text-slate-900">You're verified</h2>
          <p className="mt-1 text-sm text-slate-500">Your Verified Student badge is on your profile.</p>
          <Button className="mt-5" onClick={() => router.push("/")}>Back to marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Verification" />

      <div className={`mx-auto max-w-md space-y-4 px-4 pt-4 ${step === "start" ? "pb-8" : "pb-28"}`}>
        {step === "start" ? (
          <>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                {isProvisional ? "Complete your verification" : "Verify you're a student"}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">Takes about a minute.</p>
              {!isProvisional && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[
                    [Store, "Sell & subscribe"],
                    [BadgeCheck, "Verified badge"],
                    [Coins, "150 App Credit"],
                  ].map(([Icon, text]) => (
                    <span key={text} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-3 w-3 text-primary" /> {text}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {statusCard()}

            {!checkRunning && (
              <div className="space-y-2.5">
                {isProvisional ? (
                  routeCard(IdCard, "Add my student ID card", "Get the Verified badge and 150 App Credit", () => start(ID_CARD))
                ) : (
                  <>
                    {routeCard(IdCard, "I have my student ID card", "Usually verified in under a minute", () => start(ID_CARD))}
                    {routeCard(GraduationCap, "I'm a fresher without an ID yet", "100 or 200 level — portal or library card", () => start(FRESHER))}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Step header */}
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200/60"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
              <div className="mt-2 flex gap-1">
                {steps.map((s, i) => (
                  <span key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-slate-200"}`} />
                ))}
              </div>
              <h2 className="mt-3 text-base font-bold text-slate-900">{stepTitles[step]}</h2>
              <p className="text-xs text-slate-500">{stepSubtitles[step]}</p>
            </div>

            {step === "details" && (
              <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                {isFresher && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-700">Which document do you have?</span>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                      {[
                        [PORTAL, Monitor, "Portal screenshot"],
                        [LIBRARY, BookOpen, "Library card"],
                      ].map(([value, Icon, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setDocumentType(value);
                            resetPhotos();
                          }}
                          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
                            documentType === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {field("fullName", "Full name", fullName, setFullName, "e.g. Adeyemi Tolu Grace", "At least two names, as on your document.")}
                {!isFresher &&
                  field("matricNumber", "Matric number", matricNumber, setMatricNumber, "e.g. LCU/UG/25/12345")}
                {isFresher && documentType === PORTAL &&
                  field("tempMatric", "Matriculation number", tempMatric, setTempMatric, "e.g. 2601234", "The 7 digits on your portal.", { inputMode: "numeric", maxLength: 7 })}
                {isFresher && documentType === LIBRARY &&
                  field("libraryCardNumber", "Library Card No", libraryCardNumber, setLibraryCardNumber, "e.g. 21246", "The number on the front of the card.", { inputMode: "numeric", maxLength: 8 })}
              </div>
            )}

            {step === "photos" && (
              <div className="space-y-3">
                <DocumentGuide documentType={isFresher ? documentType : "student_id"} />
                <div className="space-y-2">
                  {!isFresher && (
                    <>
                      {photoTile("front", "Front of ID card", "Tap to add a photo")}
                      {photoTile("back", "Back of ID card", "Tap to add a photo")}
                    </>
                  )}
                  {isFresher && documentType === PORTAL && photoTile("front", "Portal screenshot", "The whole screen, address bar included")}
                  {isFresher && documentType === LIBRARY && (
                    <>
                      {photoTile("front", "Front of library card", "Tap to add a photo")}
                      {photoTile("back", "Back of library card", "Tap to add a photo")}
                    </>
                  )}
                </div>
              </div>
            )}

            {step === "selfie" && (
              <div className="space-y-4">
                <SelfieCapture
                  value={photos.selfie}
                  disabled={loading}
                  onChange={(file, source) => {
                    setPhotos((p) => ({ ...p, selfie: file }));
                    setSelfieSource(source);
                  }}
                />
                <label className="flex items-start gap-2.5 rounded-2xl bg-white p-3 text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    disabled={loading}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(37,99,235)]"
                  />
                  <span>
                    I agree that TrybeMarket keeps my document photos and selfie privately to confirm I'm a Lead City
                    student and to trace an account if a dispute comes up — for as long as my account exists. Only the
                    verification team can view them, and every view is logged. To ask for deletion, email{" "}
                    <a href="mailto:contact@trybemarket.online" className="underline">contact@trybemarket.online</a>.
                  </span>
                </label>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom action bar, within thumb reach */}
      {step !== "start" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <Button size="lg" className="w-full" onClick={goNext} disabled={!stepReady || loading} loading={loading}>
              {loading ? "Submitting…" : isLastStep ? "Submit" : "Continue"}
            </Button>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(env(safe-area-inset-bottom),24px)] text-center shadow-xl sm:rounded-3xl">
            <span
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
                modal.icon === "success" ? "bg-emerald-50 text-emerald-500" : modal.icon === "pending" ? "bg-blue-50 text-primary" : "bg-amber-50 text-amber-500"
              }`}
            >
              {modal.icon === "success" ? <CheckCircle className="h-6 w-6" /> : modal.icon === "pending" ? <Clock className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </span>
            <h3 className="mt-3 text-base font-bold text-slate-900">{modal.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{modal.message}</p>
            {modal.action === "use_id_card" ? (
              <Button size="lg" className="mt-5 w-full" onClick={switchToIdCard}>Use my student ID card</Button>
            ) : (
              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={() => {
                  setModal(null);
                  router.back();
                }}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const NOTICE_TONES = {
  blue: "bg-blue-50 text-primary ring-blue-100",
  amber: "bg-amber-50 text-amber-600 ring-amber-100",
  red: "bg-red-50 text-red-600 ring-red-100",
};

function Notice({ tone, Icon, spin = false, title, text }) {
  return (
    <div className={`flex gap-2.5 rounded-2xl p-3 ring-1 ${NOTICE_TONES[tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${spin ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  );
}
