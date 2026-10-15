"use client";

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertCircle, BadgeCheck, Coins, Lock, Camera } from "lucide-react";
import { useUser } from "@/context/UserContext";
import toast from "react-hot-toast";
import convertToBase64 from "@/hooks/useConvertToBase64";
import Header from "@/components/Header";


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
  const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
  const router = useRouter();
  const { currentUser } = useUser() || {};

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

  // Upload image to Cloudinary — straight from the browser, or through our
  // server (/api/kyc-upload) when the browser can't reach Cloudinary at all:
  // some students' networks reach our site but not api.cloudinary.com.
  const uploadImageToCloudinary = async (file) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Only JPEG, PNG, or GIF images are allowed.");
    }
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_PRESET);
    data.append("cloud_name", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

    let res;
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
        }/image/upload`,
        {
          method: "POST",
          body: data,
        }
      );
      res = await response.json().catch(() => ({}));
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      // Recorded even when the retry below works, so we can see how often it's needed.
      reportClientError("uploading straight to Cloudinary (retrying through our server)", error, [file]);
      return uploadThroughServer(file);
    }
    if (!res.secure_url) {
      // Keep Cloudinary's own reason (file too large, format not allowed…) —
      // it used to be swallowed, leaving only a generic "try again" toast.
      console.error("Cloudinary Upload Error:", res.error);
      throw new Error(res.error?.message || "the image server rejected the photo");
    }
    return res.secure_url;
  };

  const uploadThroughServer = async (file) => {
    const idToken = await getAuth().currentUser.getIdToken();
    const data = new FormData();
    data.append("file", file);
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
    if (!response.ok || !res.url) {
      throw new Error(res.error || `the upload failed (${response.status})`);
    }
    return res.url;
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

      const kycDocRef = doc(db, "kycRequests", user.uid);
      const kycDoc = await getDoc(kycDocRef);

      if (kycDoc.exists()) {
        const kycData = kycDoc.data();
        // Allow resubmission only if status is "rejected"
        if (kycData.status === "pending") {
          setLoading(false);
          setModalMessage("You already have a KYC request under review.");
          setModalIconType("caution");
          setModalVisible(true);
          return;
        }
        if (kycData.status === "approved" || kycData.status === "verified") {
          setLoading(false);
          setModalMessage("Your KYC has already been approved.");
          setModalIconType("success");
          setModalVisible(true);
          return;
        }
        // If status is "rejected", allow resubmission (continue to upload)
      }

      // Upload to Cloudinary as before
      step = "uploading the front of your ID";
      const frontIDUrl = await uploadImageToCloudinary(frontID);
      step = "uploading the back of your ID";
      const backIDUrl = await uploadImageToCloudinary(backID);

      // Convert images to base64 (strip prefix)
      step = "reading your photos";
      const frontBase64Full = await convertToBase64(frontID);
      const backBase64Full = await convertToBase64(backID);
      const frontBase64 = frontBase64Full.split(",")[1];
      const backBase64 = backBase64Full.split(",")[1];

      // Store pending KYC as before
      step = "saving your request";
      await setDoc(doc(db, "kycRequests", user.uid), {
        userId: user.uid,
        fullName,
        matricNumber,
        frontID: frontIDUrl,
        backID: backIDUrl,
        status: "pending",
        notificationSent: false,
        submittedAt: new Date(),
      });

      // Both calls below prove who is asking with the ID token. kyc-notify reads
      // the details from the request just stored above (nothing to send in the
      // body), and a failure to notify the team must never block the submission.
      step = "sending your request for verification";
      const idToken = await user.getIdToken();
      await fetch("/api/kyc-notify", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      }).catch((error) => console.error("Error notifying the team of a KYC request:", error));

      // Send to background KYC verification — identity is proven by the ID
      // token, not the userId in the body (see app/api/kyc-submit/route.js).
      const submitResponse = await fetch("/api/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          userId: user.uid,
          fullName,
          matricNumber,
          frontID: frontBase64,
          backID: backBase64,
        }),
      });

      const submitData = await submitResponse.json().catch(() => ({}));
      if (!submitResponse.ok) {
        toast.error(submitData.error || "Failed to submit KYC, please try again.");
        return;
      }
      if (submitData.rejectionReason === "matric_already_used") {
        setModalMessage(
          "This matric number is already linked to another verified account. If you believe this is a mistake, please contact support."
        );
        setModalIconType("caution");
        setModalVisible(true);
        return;
      }

      setModalMessage(
        "Your KYC request has been submitted. Please wait for verification."
      );
      setModalIconType("success");
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
        {currentUser?.isVerified ? (
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

            {/* Form */}
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
