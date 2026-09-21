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

  // Handle file selection and preview
  const pickImage = (setImage, setPreview) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => {
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
        setImage(file);
        setPreview(URL.createObjectURL(file));
      }
    };
    input.click();
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (file) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      throw new Error("Only JPEG, PNG, or GIF images are allowed.");
    }
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_PRESET);
    data.append("cloud_name", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

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

      const res = await response.json();
      if (res.secure_url) {
        return res.secure_url;
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Cloudinary Upload Error:", error);
      throw new Error("Image upload failed.");
    }
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
      const frontIDUrl = await uploadImageToCloudinary(frontID);
      const backIDUrl = await uploadImageToCloudinary(backID);

      // Convert images to base64 (strip prefix)
      const frontBase64Full = await convertToBase64(frontID);
      const backBase64Full = await convertToBase64(backID);
      const frontBase64 = frontBase64Full.split(",")[1];
      const backBase64 = backBase64Full.split(",")[1];

      // Store pending KYC as before
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
      console.error("Error in handleSubmit:", error);
      toast.error("Failed to submit Kyc, Please try again.");
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
