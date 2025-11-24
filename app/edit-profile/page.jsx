// app/edit-profile/page.jsx
"use client";

import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiCamera } from "react-icons/fi";
import { ChevronLeft } from "lucide-react";
import { useUser } from "../../context/UserContext";
import toast from "react-hot-toast"; // Using react-hot-toast
import Header from "@/components/Header";

export default function EditProfilePage() {
  const { currentUser, setCurrentUser } = useUser();
  const router = useRouter();

  const [name, setName] = useState("");
  const [matricNum, setMatricNum] = useState("");
  const [image, setImage] = useState("");
  const [moreInfo, setMoreInfo] = useState("");
  const [selected, setSelected] = useState("hostelite");
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  // Populate form with user data
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.fullName || "");
      setMatricNum(currentUser.matricNumber || "");
      setImage(currentUser.profilePicture || "");
      setMoreInfo(currentUser.address || "");
      setSelected(currentUser.locationType || "hostelite");
      setPreviewImage(currentUser.profilePicture || "");
      setIsFetching(false);
    }
  }, [currentUser]);

  // Function to upload image to Cloudinary
  const uploadImageToCloudinary = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "ProfilePictures");
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

  // Function to handle image selection
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  // Function to save updated profile data
  const handleSave = async () => {
    setLoading(true);
    try {
      let imageUrl = image;

      if (image && image !== currentUser.profilePicture) {
        imageUrl = await uploadImageToCloudinary(image);
      }

      const updatedUserData = {
        fullName: name,
        matricNumber: matricNum,
        profilePicture: imageUrl,
        address: moreInfo,
        locationType: selected,
      };

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, updatedUserData);

      setCurrentUser((prevUser) => ({
        ...prevUser,
        ...updatedUserData,
      }));

      toast.success("Profile updated successfully");
      router.push("/");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (isFetching) {
    return (
      <div className='min-h-screen bg-white flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
          <p className='mt-4 text-gray-600'>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-4 mb-4 max-w-6xl'>
     <Header title={"Edit Profile"}/>

      <Card className='border border-gray-200'>
        
        <CardContent className='space-y-4 mt-8 mb-4'>
          {/* Profile Image Picker */}
          <div className='flex flex-col items-center mb-6 relative'>
            <div className='w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center'>
              {previewImage ? (
                <img
                  src={previewImage}
                  alt='Profile'
                  className='w-full h-full object-cover'
                />
              ) : (
                <span className='text-gray-500'>No Image</span>
              )}
            </div>
            <label className='absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600 transition'>
              <FiCamera size={20} />
              <input
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleImageChange}
                disabled={loading}
              />
            </label>
          </div>

          {/* Inputs Section */}
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='fullName'>Full Name</Label>
              <Input
                id='fullName'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Full Name'
                disabled={loading}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='matricNumber'>Matric Number</Label>
              <Input
                id='matricNumber'
                value={matricNum}
                onChange={(e) => setMatricNum(e.target.value)}
                placeholder='LCU/UG/XX/XXXX'
                disabled={loading}
              />
            </div>

            <div className='space-y-2'>
              <Label>Location</Label>
              <div className='flex space-x-4'>
                <div className='flex items-center'>
                  <input
                    type='radio'
                    id='hostelite'
                    value='hostelite'
                    checked={selected === "hostelite"}
                    onChange={() => setSelected("hostelite")}
                    className='mr-2'
                    disabled={loading}
                  />
                  <label
                    htmlFor='hostelite'
                    className='text-sm font-medium text-gray-600'
                  >
                    Hostelite
                  </label>
                </div>
                <div className='flex items-center'>
                  <input
                    type='radio'
                    id='non-hostelite'
                    value='non-hostelite'
                    checked={selected === "non-hostelite"}
                    onChange={() => setSelected("non-hostelite")}
                    className='mr-2'
                    disabled={loading}
                  />
                  <label
                    htmlFor='non-hostelite'
                    className='text-sm font-medium text-gray-600'
                  >
                    Non-Hostelite
                  </label>
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='moreInfo'>More Information</Label>
              <Input
                id='moreInfo'
                value={moreInfo}
                onChange={(e) => setMoreInfo(e.target.value)}
                placeholder='Room Number, Hostel Name, etc.'
                disabled={loading}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className='w-full'>
            {loading ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
