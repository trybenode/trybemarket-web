"use client";

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, CheckCircle, AlertCircle } from "lucide-react";
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
        setLoading(false);
        setModalMessage("You already have a KYC request under review.");
        setModalIconType("caution");
        setModalVisible(true);
        return;
      }

      // Upload to Cloudinary as before
      const frontIDUrl = await uploadImageToCloudinary(frontID);
      const backIDUrl = await uploadImageToCloudinary(backID);

      // Convert images to base64 (strip prefix)
      const frontBase64Full = await convertToBase64(frontID);
      const backBase64Full = await convertToBase64(backID);
      const frontBase64 = frontBase64Full.split(",")[1];
      const backBase64 = backBase64Full.split(",")[1];

      // Get user email
      const email = getUserEmail();

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
      await fetch("/api/kyc-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fullName,
          matricNumber,
        }),
      });

      // Send to background KYC verification
      await fetch("/api/kyc-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fullName,
          matricNumber,
          frontIDUrl,
          backIDUrl,
          email,
        }),
      });

      
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

  return (
    <div className='min-h-screen bg-white'>
      <div className='container mx-auto px-4 py-4 max-w-lg'>
        <Header title={"KYC Registration"}/>

        <Card className='border border-gray-200'>
          <CardContent className='space-y-4 pt-6'>
            <div className='space-y-2'>
              <Label htmlFor='fullName'>Full Name</Label>
              <Input
                id='fullName'
                placeholder='Full Name'
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='matricNumber'>Matric Number</Label>
              <Input
                id='matricNumber'
                placeholder='Matric Number'
                value={matricNumber}
                onChange={(e) => setMatricNumber(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Front ID Upload */}
            <div className='space-y-2'>
              <Label>Front ID Image</Label>
              <button
                className='w-full rounded-md border border-gray-300 bg-white p-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                onClick={() => pickImage(setFrontID, setFrontIDPreview)}
                disabled={loading}
              >
                {frontID ? "Image Selected" : "Choose Front ID Image"}
              </button>
              {frontIDPreview && (
                <img
                  src={frontIDPreview}
                  alt='Front ID Preview'
                  className='mt-2 h-24 w-32 rounded-md object-cover'
                />
              )}
              <p className='text-xs text-red-500'>
                * Upload photo of front of ID card
              </p>
            </div>

            {/* Back ID Upload */}
            <div className='space-y-2'>
              <Label>Back ID Image</Label>
              <button
                className='w-full rounded-md border border-gray-300 bg-white p-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                onClick={() => pickImage(setBackID, setBackIDPreview)}
                disabled={loading}
              >
                {backID ? "Image Selected" : "Choose Back ID Image"}
              </button>
              {backIDPreview && (
                <img
                  src={backIDPreview}
                  alt='Back ID Preview'
                  className='mt-2 h-24 w-32 rounded-md object-cover'
                />
              )}
              <p className='text-xs text-red-500'>
                * Upload photo of back of ID card
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={
                !fullName || !matricNumber || !frontID || !backID || loading
              }
              className='w-full'
            >
              {loading ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      {modalVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <Card className='w-80 sm:w-96 border border-gray-200'>
            <CardContent className='space-y-4 pt-6'>
              <div className='flex justify-center'>
                {modalIconType === "success" ? (
                  <CheckCircle className='h-12 w-12 text-green-500' />
                ) : (
                  <AlertCircle className='h-12 w-12 text-yellow-500' />
                )}
              </div>
              <p className='text-center text-gray-700'>{modalMessage}</p>
              <Button
                className='w-full'
                onClick={() => {
                  setModalVisible(false);
                  router.back();
                }}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
