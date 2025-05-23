"use client"; // Required for client-side features

import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { Input } from "@/components/ui/input"; // shadcn/ui Input component
import { db } from "@/lib/firebase"; // Adjust path as needed

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

  const router = useRouter();

  // Handle file selection and preview
  const pickImage = (setImage, setPreview) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (file) {
        setImage(file);
        setPreview(URL.createObjectURL(file));
      }
    };
    input.click();
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "KycUploads");
    data.append("cloud_name", "dj21x4jnt");

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dj21x4jnt/image/upload",
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

  // Handle form submission
  const handleSubmit = async () => {
    if (!fullName || !matricNumber || !frontID || !backID) {
      alert("All fields are required.");
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setLoading(false);
        alert("Authentication Error: Please log in first.");
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

      const frontIDUrl = await uploadImageToCloudinary(frontID);
      const backIDUrl = await uploadImageToCloudinary(backID);

      console.log("User id:", user.uid);
      await setDoc(doc(db, "kycRequests", user.uid), {
        userId: user.uid,
        fullName,
        matricNumber,
        frontID: frontIDUrl,
        backID: backIDUrl,
        status: "pending",
        submittedAt: new Date(),
      });

      setModalMessage(
        "Your KYC request has been submitted. Please wait for verification."
      );
      setModalIconType("success");
      setModalVisible(true);
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      alert(`Failed to submit KYC: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Main Content */}
      <div className='mx-auto max-w-md p-4 sm:p-6 md:max-w-lg lg:max-w-xl'>
        <h1 className='mb-6 text-center text-2xl font-bold text-gray-800 sm:text-3xl'>
          KYC Registration
        </h1>
        <div className='rounded-lg bg-white p-6 shadow-md'>
          <Input
            placeholder='Full Name'
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className='mb-4'
          />
          <Input
            placeholder='Matric Number'
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value)}
            className='mb-4'
          />

          {/* Front ID Upload */}
          <div className='mb-4'>
            <button
              className='w-full rounded-md border border-gray-300 bg-white p-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
              onClick={() => pickImage(setFrontID, setFrontIDPreview)}
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
            <p className='mt-1 text-xs text-red-500'>
              * Upload photo of front of ID card
            </p>
          </div>

          {/* Back ID Upload */}
          <div className='mb-6'>
            <button
              className='w-full rounded-md border border-gray-300 bg-white p-3 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
              onClick={() => pickImage(setBackID, setBackIDPreview)}
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
            <p className='mt-1 text-xs text-red-500'>
              * Upload photo of back of ID card
            </p>
          </div>

          {/* Submit Button */}
          <div className='flex justify-center'>
            <button
              className={`w-full rounded-md px-4 py-3 text-lg font-semibold text-white sm:w-1/2 ${
                fullName && matricNumber && frontID && backID
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "cursor-not-allowed bg-gray-400"
              }`}
              onClick={handleSubmit}
              disabled={
                !fullName || !matricNumber || !frontID || !backID || loading
              }
            >
              {loading ? (
                <svg
                  className='mx-auto h-5 w-5 animate-spin text-white'
                  xmlns='http://www.w3.org/2000/svg'
                  fill='none'
                  viewBox='0 0 24 24'
                >
                  <circle
                    className='opacity-25'
                    cx='12'
                    cy='12'
                    r='10'
                    stroke='currentColor'
                    strokeWidth='4'
                  />
                  <path
                    className='opacity-75'
                    fill='currentColor'
                    d='M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z'
                  />
                </svg>
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-80 rounded-lg bg-white p-6 shadow-lg sm:w-96'>
            <div className='mb-4 flex justify-center'>
              {modalIconType === "success" ? (
                <svg
                  className='h-12 w-12 text-green-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
              ) : (
                <svg
                  className='h-12 w-12 text-yellow-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              )}
            </div>
            <p className='mb-4 text-center text-gray-700'>{modalMessage}</p>
            <button
              className='w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              onClick={() => {
                setModalVisible(false);
                router.back();
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
