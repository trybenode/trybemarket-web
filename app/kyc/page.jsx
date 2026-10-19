"use client";

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, BadgeCheck, Coins, Lock, Camera, Clock, Loader2 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import { isKycCheckRunning, isKycCleared, KYC_CHECK_STALE_MS } from "@/lib/kycAccess";

const MATRIC_CONFLICT_MESSAGE =
  "This matric number is already linked to another verified account. If you believe this is a mistake, please contact support.";


export default function KycPage() {
  const [fullName, setFullName] = useState("");
  const [matricNumber, setMatricNumber] = useState("");
  const [frontID, setFrontID] = useState(null);
  const [backID, setBackID] = useState(null);
  const [frontIDPreview, setFrontIDPreview] = useState(null);
  const [backIDPreview, setBackIDPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalIconType, setModalIconType] = useState("success");
  // GIFs are accepted when picked but re-encoded to JPEG (prepareIdPhoto) —
  // only JPEG and PNG are stored.
  const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
  const router = useRouter();
  const { currentUser } = useUser() || {};
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

  // revoke object URLs when the component unmounts or when image previews change
  useEffect(() => {
    return () => {
      if (frontIDPreview) URL.revokeObjectURL(frontIDPreview);
      if (backIDPreview) URL.revokeObjectURL(backIDPreview);
    };
  }, [frontIDPreview, backIDPreview]);

  // Send a failure from this page to /api/client-error, so it shows up in the
  // Vercel logs and Firestore `clientErrors` instead of only in the student's
  // browser. Best-effort: never throws.
  const reportClientError = (step, error, files = [frontID, backID]) => {
    getAuth().currentUser?.getIdToken()
      .then((idToken) =>
        fetch("/api/client-error", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            where: "kyc",
            step,
            errorName: error?.name,
            errorMessage: error?.message,
            errorCode: error?.code,
            files: files.map((f) => ({ type: f?.type, size: f?.size })),
            online: navigator.onLine,
          }),
        })
      )
      .catch(() => {});
  };

  // Copies the picked photo into memory as a JPEG no larger than
  // MAX_ID_PHOTO_SIDE on its longest side. On Android, Chrome can fail to read a
  // gallery/Google Photos pick again at upload time (ERR_UPLOAD_FILE_CHANGED,
  // surfacing as "Failed to fetch") even though the preview showed; an
  // in-memory copy can't go stale. It also keeps uploads small on slow data
  // while leaving an ID card's text sharp enough for the OCR check.
  const MAX_ID_PHOTO_SIDE = 2000;
  const prepareIdPhoto = async (file) => {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, MAX_ID_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("couldn't re-encode the photo"))), "image/jpeg", 0.9)
      );
      return new File([blob], "id-photo.jpg", { type: "image/jpeg" });
    } catch (error) {
      // Couldn't decode it here — fall back to a plain in-memory copy (this
      // throws too if the phone can't read the file at all).
      reportClientError("preparing the photo (fell back to a plain copy)", error, [file]);
      return new File([await file.arrayBuffer()], file.name, { type: file.type });
    }
  };

  // Handle file selection and preview
  const pickImage = (setImage, setPreview) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (file) {
        if (!VALID_IMAGE_TYPES.includes(file.type)) {
          toast.error("Only JPEG, PNG, or GIF images are allowed.");
          return;
        }
        // Validate file size (e.g., max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error("Image size must be less than 5MB.");
          return;
        }
        let photo;
        try {
          photo = await prepareIdPhoto(file);
        } catch (error) {
          reportClientError("reading the picked photo", error, [file]);
          toast.error("We couldn't read that photo. Take a new photo with your camera, or save it to your phone first, then pick it again.");
          return;
        }
        setImage(photo);
        setPreview(URL.createObjectURL(photo));
      }
    };
    input.click();
  };

  // Uploads one ID photo privately to Cloudinary — straight from the browser
  // with a signature from our server, or through our server
  // (/api/kyc-upload) when the browser can't reach Cloudinary at all: some
  // students' networks reach our site but not api.cloudinary.com. Either way
  // the server decides where it goes (the student's own kyc/<uid>/ folder),
  // that it's private, and the allowed formats and size.
  //
  // @returns {{ publicId, version, signature }} — what /api/kyc-submit expects
  const uploadKycPhoto = async (file, slot) => {
    const idToken = await getAuth().currentUser.getIdToken();
    const signResponse = await fetch("/api/kyc/upload-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ slot }),
    });
    const signed = await signResponse.json().catch(() => ({}));
    if (!signResponse.ok || !signed.uploadUrl) {
      throw new Error(signed.error || `couldn't prepare the upload (${signResponse.status})`);
    }

    const data = new FormData();
    data.append("file", file);
    Object.entries(signed.params).forEach(([key, value]) => data.append(key, value));

    let res;
    try {
      const response = await fetch(signed.uploadUrl, { method: "POST", body: data });
      res = await response.json().catch(() => ({}));
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      // Recorded even when the retry below works, so we can see how often it's needed.
      reportClientError("uploading straight to Cloudinary (retrying through our server)", error, [file]);
      return uploadThroughServer(file, slot);
    }
    if (!res.public_id || !res.signature) {
      // Keep Cloudinary's own reason (file too large, format not allowed…) —
      // it used to be swallowed, leaving only a generic "try again" toast.
      console.error("Cloudinary Upload Error:", res.error);
      throw new Error(res.error?.message || "the image server rejected the photo");
    }
    return { publicId: res.public_id, version: res.version, signature: res.signature };
  };

  const uploadThroughServer = async (file, slot) => {
    const idToken = await getAuth().currentUser.getIdToken();
    const data = new FormData();
    data.append("file", file);
    data.append("slot", slot);
    let response;
    try {
      response = await fetch("/api/kyc-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: data,
      });
    } catch (error) {
      // Keep the browser's own error: "Failed to fetch" (no connection) and
      // NotReadableError (the phone couldn't read the photo) need different fixes.
      throw new Error(`couldn't upload the photo (${error?.name}: ${error?.message})`);
    }
    const res = await response.json().catch(() => ({}));
    if (!response.ok || !res.publicId) {
      throw new Error(res.error || `the upload failed (${response.status})`);
    }
    return res;
  };

  const getUserEmail = () => {
    try {
      // Try userStore first
      const store = require("@/lib/userStore").default;
      if (store?.getState()?.user?.email) return store.getState().user.email;
    } catch {}
    // Try localStorage fallback
    if (typeof window !== "undefined") {
      const user = JSON.parse(localStorage.getItem("user-storage"));
      if (user?.state?.user?.email) return user.state.user.email;
    }
    return null;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!fullName || !matricNumber || !frontID || !backID) {
      toast.error("All fields are required.");
      return;
    }

    setLoading(true);
    // Which step is running, so a failure says where it happened instead of a
    // bare "try again" (these all failed silently into the same toast before).
    let step = "checking your account";

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        toast.error("Please log in to submit KYC.");
        router.push("/login");
        return;
      }

      // Upload both photos to the student's own folder…
      step = "uploading the front of your ID";
      const front = await uploadKycPhoto(frontID, "front");
      step = "uploading the back of your ID";
      const back = await uploadKycPhoto(backID, "back");

      // …then one call does the rest server-side: saves the request, checks
      // both stored photos, and verifies or hands it to our team. Identity is
      // proven by the ID token (see app/api/kyc-submit/route.js).
      step = "sending your request for verification";
      const idToken = await user.getIdToken();
      const submitResponse = await fetch("/api/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fullName, matricNumber, photos: { front, back } }),
      });

      const submitData = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok) {
        // The server's message says what to fix (name, matric number, already verified…).
        toast.error(submitData.error || "Failed to submit KYC, please try again.", { duration: 8000 });
        return;
      }

      if (submitData.status === "verified") {
        setModalMessage("You're verified! Your Verified Student badge and 150 App Credit have been added to your account.");
        setModalIconType("success");
      } else if (submitData.rejectionReason === "matric_already_used") {
        setModalMessage(MATRIC_CONFLICT_MESSAGE);
        setModalIconType("caution");
      } else if (submitData.status === "pending") {
        setModalMessage(
          "Thanks! We couldn't confirm your ID automatically, so our team will review it. We'll email you as soon as it's done."
        );
        setModalIconType("caution");
      } else {
        setModalMessage("Your KYC request has been updated.");
        setModalIconType("success");
      }
      setModalVisible(true);
    } catch (error) {
      console.error(`Error in handleSubmit (${step}):`, error);
      reportClientError(step, error);
      toast.error(`Failed while ${step}: ${error?.message || "unknown error"}. Please try again.`, { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  // One ID-upload tile: dashed and tappable until a photo is chosen, then shows the photo.
  const uploadTile = (label, file, preview, onPick, hint) => (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <button
        type='button'
        onClick={onPick}
        disabled={loading}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
          file ? "border-emerald-300 bg-emerald-50/50" : "border-dashed border-slate-300 bg-white hover:border-primary/50 hover:bg-blue-50/40"
        }`}
      >
        {preview ? (
          <img src={preview} alt={`${label} preview`} className='h-16 w-24 shrink-0 rounded-xl object-cover' />
        ) : (
          <span className='flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400'>
            <Camera className='h-6 w-6' />
          </span>
        )}
        <span className='min-w-0'>
          <span className='block text-sm font-semibold text-slate-900'>
            {file ? "Photo selected — tap to change" : "Tap to choose a photo"}
          </span>
          <span className='block text-xs text-slate-500'>{hint}</span>
        </span>
      </button>
    </div>
  );

  return (
    <div className='min-h-screen bg-slate-50 pb-16'>
      <Header title="KYC Registration" />
      <div className='mx-auto max-w-xl px-4 py-5 space-y-4'>
        {isKycCleared(currentUser) ? (
          <div className='rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center'>
            <BadgeCheck className='mx-auto h-12 w-12 text-emerald-500' />
            <h2 className='mt-3 text-lg font-bold text-slate-900'>You're already verified</h2>
            <p className='mt-1 text-sm text-slate-600'>Nothing more to do here — your Verified Student badge is on your profile.</p>
            <Button className='mt-5' onClick={() => router.push("/")}>Back to marketplace</Button>
          </div>
        ) : (
          <>
            {/* Why */}
            <div className='rounded-3xl border border-brand-yellow-deep/40 bg-gradient-to-br from-brand-yellow-soft to-white p-5'>
              <h2 className='text-lg font-extrabold tracking-tight text-slate-900'>Verify you're a student</h2>
              <p className='mt-1 text-sm text-slate-600'>It takes a minute and unlocks more on TrybeMarket.</p>
              <ul className='mt-3 space-y-2 text-sm text-slate-700'>
                <li className='flex items-center gap-2'><BadgeCheck className='h-4 w-4 shrink-0 text-emerald-600' /> A Verified Student badge on your profile</li>
                <li className='flex items-center gap-2'><Coins className='h-4 w-4 shrink-0 text-amber-600' /> 150 App Credit when you're approved</li>
                <li className='flex items-center gap-2'><Lock className='h-4 w-4 shrink-0 text-primary' /> Required to subscribe to a plan</li>
              </ul>
            </div>

            {/* Where their last request stands */}
            {checkRunning ? (
              <div className='flex gap-3 rounded-3xl border border-blue-200 bg-blue-50 p-5'>
                <Loader2 className='h-5 w-5 shrink-0 animate-spin text-primary' />
                <div>
                  <p className='font-semibold text-slate-900'>Checking your ID…</p>
                  <p className='mt-0.5 text-sm text-slate-600'>This usually takes under a minute.</p>
                </div>
              </div>
            ) : kycRequest?.status === "pending" ? (
              <div className='flex gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5'>
                <Clock className='h-5 w-5 shrink-0 text-amber-600' />
                <div>
                  <p className='font-semibold text-slate-900'>Your request is being reviewed</p>
                  <p className='mt-0.5 text-sm text-slate-600'>
                    Our team will email you when it's done. Made a mistake? You can submit again below.
                  </p>
                </div>
              </div>
            ) : kycRequest?.status === "rejected" ? (
              <div className='flex gap-3 rounded-3xl border border-red-200 bg-red-50 p-5'>
                <AlertCircle className='h-5 w-5 shrink-0 text-red-600' />
                <div>
                  <p className='font-semibold text-slate-900'>Your last request wasn't approved</p>
                  <p className='mt-0.5 text-sm text-slate-600'>
                    {kycRequest.rejectionReason === "matric_already_used"
                      ? MATRIC_CONFLICT_MESSAGE
                      : kycRequest.rejectionReason || "Check your details and photos, then submit again below."}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Form — hidden while a check is running (it can't be resubmitted until it finishes) */}
            {!checkRunning && (
            <div className='space-y-5 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm'>
              <div className='space-y-2'>
                <Label htmlFor='fullName'>Full name</Label>
                <Input
                  id='fullName'
                  placeholder='As shown on your ID'
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className='h-11'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='matricNumber'>Matric number</Label>
                <Input
                  id='matricNumber'
                  placeholder='e.g. LCU/UG/XX/XXXXX'
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  disabled={loading}
                  className='h-11'
                />
              </div>

              {uploadTile("Front of ID card", frontID, frontIDPreview, () => pickImage(setFrontID, setFrontIDPreview), "JPEG, PNG or GIF, up to 5MB")}
              {uploadTile("Back of ID card", backID, backIDPreview, () => pickImage(setBackID, setBackIDPreview), "JPEG, PNG or GIF, up to 5MB")}

              <p className='text-xs leading-relaxed text-slate-500'>
                Use a clear, well-lit photo where your name and matric number are easy to read.
              </p>

              <Button
                size='lg'
                onClick={handleSubmit}
                loading={loading}
                disabled={!fullName || !matricNumber || !frontID || !backID}
                className='w-full'
              >
                {loading ? "Submitting…" : "Submit for verification"}
              </Button>
            </div>
            )}
          </>
        )}
      </div>

      {/* Result */}
      {modalVisible && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4'>
          <div className='w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl'>
            <div className='flex justify-center'>
              {modalIconType === "success" ? (
                <CheckCircle className='h-12 w-12 text-emerald-500' />
              ) : (
                <AlertCircle className='h-12 w-12 text-amber-500' />
              )}
            </div>
            <p className='mt-3 text-slate-700'>{modalMessage}</p>
            <Button
              size='lg'
              className='mt-5 w-full'
              onClick={() => {
                setModalVisible(false);
                router.back();
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
