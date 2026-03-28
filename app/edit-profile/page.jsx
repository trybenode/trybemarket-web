// app/edit-profile/page.jsx
"use client";

import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FiCamera } from "react-icons/fi";
import { ChevronLeft, Bell, Mail, MessageSquare, Check } from "lucide-react";
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
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Notification settings state
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);

  // Populate form with user data
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.fullName || "");
      setMatricNum(currentUser.matricNumber || "");
      setImage(currentUser.profilePicture || "");
      setMoreInfo(currentUser.address || "");
      setSelected(currentUser.locationType || "hostelite");
      setPreviewImage(currentUser.profilePicture || "");
      
      // Populate notification settings
      // Convert stored international format (234XXXXXXXXXX) to Nigerian format (08XXXXXXXXX)
      let displayPhone = currentUser.phone || "";
      if (displayPhone.startsWith("234")) {
        displayPhone = "0" + displayPhone.substring(3); // Remove 234, add 0
      }
      setPhone(displayPhone);
      setEmailNotifications(currentUser.emailNotifications !== false);
      setWhatsappNotifications(currentUser.whatsappNotifications || false);
      
      setIsFetching(false);
    }
  }, [currentUser]);

  // Validate phone number (Nigerian format: 08012345678 or 8012345678)
  const validatePhone = (value) => {
    if (!value) return ""; // Empty is valid
    
    // Remove all non-digit characters
    const cleaned = value.replace(/\D/g, "");
    
    // Nigerian mobile network prefixes
    const validPrefixes = [
      '0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709',
      '0802', '0803', '0804', '0805', '0806', '0807', '0808', '0809',
      '0810', '0811', '0812', '0813', '0814', '0815', '0816', '0817', '0818', '0819',
      '0902', '0903', '0904', '0905', '0906', '0907', '0908', '0909',
      '0912', '0913', '0915', '0916'
    ];
    
    // Check if it starts with 0 or is just 10 digits
    if (cleaned.startsWith("0")) {
      // Format: 08012345678 (11 digits)
      if (cleaned.length !== 11) {
        return "Phone must be 11 digits (e.g., 08012345678)";
      }
      // Check if starts with valid Nigerian prefix
      const prefix = cleaned.substring(0, 4);
      if (!validPrefixes.includes(prefix)) {
        return "Invalid Nigerian mobile number";
      }
    } else {
      // Format: 8012345678 (10 digits)
      if (cleaned.length !== 10) {
        return "Phone must be 10-11 digits (e.g., 8012345678 or 08012345678)";
      }
      // Check if starts with valid Nigerian prefix (without leading 0)
      const prefix = "0" + cleaned.substring(0, 3);
      if (!validPrefixes.includes(prefix)) {
        return "Invalid Nigerian mobile number";
      }
    }
    
    return "";
  };
  
  // Convert Nigerian format to international format (234XXXXXXXXXX)
  const convertToInternationalFormat = (nigerianPhone) => {
    if (!nigerianPhone) return null;
    
    const cleaned = nigerianPhone.replace(/\D/g, "");
    
    // If starts with 0, remove it and prepend 234
    if (cleaned.startsWith("0")) {
      return "234" + cleaned.substring(1);
    }
    
    // If 10 digits without 0, just prepend 234
    return "234" + cleaned;
  };

  // Handle phone number change
  const handlePhoneChange = (e) => {
    const value = e.target.value;
    setPhone(value);
    setPhoneError(validatePhone(value));
  };

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

  // Function to save updated profile data (without notifications)
  const handleSaveProfile = async () => {
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

  // Function to save notification settings only
  const handleSaveNotifications = async () => {
    // Validate phone if WhatsApp is enabled
    if (whatsappNotifications && phone) {
      const error = validatePhone(phone);
      if (error) {
        setPhoneError(error);
        toast.error(error);
        return;
      }
    }

    // Disable WhatsApp if no valid phone
    if (whatsappNotifications && !phone) {
      toast.error("Please enter a valid phone number to enable WhatsApp notifications");
      return;
    }

    setSavingNotifications(true);
    try {
      const notificationData = {
        phone: phone ? convertToInternationalFormat(phone) : null,
        emailNotifications,
        whatsappNotifications: whatsappNotifications && phone ? true : false,
      };

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, notificationData);

      setCurrentUser((prevUser) => ({
        ...prevUser,
        ...notificationData,
      }));

      toast.success("Notification settings saved successfully");
    } catch (error) {
      console.error("Error updating notification settings:", error);
      toast.error("Failed to save notification settings. Please try again.");
    } finally {
      setSavingNotifications(false);
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
    <div className='container mx-auto px-4 py-6 mb-4 max-w-6xl'>
     <Header title={"Profile & Settings"}/>

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

          <Button onClick={handleSaveProfile} disabled={loading} className='w-full'>
            {loading ? (
              <>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings Card */}
      <Card className='border border-gray-200 mt-6'>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Bell className='h-5 w-5 text-blue-600' />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Choose how you want to receive notifications when you get new messages
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Email Notifications */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Mail className='h-5 w-5 text-blue-600' />
              <div>
                <Label htmlFor='email-notifications' className='text-base font-medium'>
                  Email Notifications
                </Label>
                <p className='text-sm text-gray-500'>Receive notifications via email</p>
              </div>
            </div>
            <Switch
              id='email-notifications'
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              disabled={savingNotifications}
            />
          </div>

          <Separator />

          {/* WhatsApp Notifications */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <MessageSquare className='h-5 w-5 text-green-600' />
                <div>
                  <Label htmlFor='whatsapp-notifications' className='text-base font-medium'>
                    WhatsApp Notifications
                  </Label>
                  <p className='text-sm text-gray-500'>Receive notifications via WhatsApp</p>
                </div>
              </div>
              <Switch
                id='whatsapp-notifications'
                checked={whatsappNotifications}
                onCheckedChange={setWhatsappNotifications}
                disabled={savingNotifications}
              />
            </div>

            {/* Phone Number Input */}
            <div className='pl-8 space-y-2'>
              <Label htmlFor='phone'>Phone Number</Label>
              <Input
                id='phone'
                type='tel'
                placeholder='08012345678'
                value={phone}
                onChange={handlePhoneChange}
                className={phoneError ? 'border-red-500' : ''}
                disabled={savingNotifications}
              />
              {phoneError && (
                <p className='text-sm text-red-600'>{phoneError}</p>
              )}
              <p className='text-xs text-gray-500'>
                Enter your Nigerian phone number (e.g., 08012345678)
              </p>
            </div>
          </div>

          <Separator />

          {/* Save Notification Settings Button */}
          <Button
            onClick={handleSaveNotifications}
            disabled={savingNotifications || (whatsappNotifications && phoneError)}
            className='w-full'
          >
            {savingNotifications ? (
              <div className='flex items-center gap-2'>
                <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white' />
                <span>Saving...</span>
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <Check className='h-4 w-4' />
                <span>Save Notification Settings</span>
              </div>
            )}
          </Button>

          {/* Info about notifications */}
          <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
            <div className='space-y-2 text-sm text-gray-600'>
              <p className='font-medium text-blue-800'>📱 About Notifications:</p>
              <ul className='list-disc list-inside space-y-1 ml-2'>
                <li>Notifications are sent when your messages reach offline users</li>
                <li>Daily sending limits apply based on your subscription plan</li>
                <li>Each notification you send counts toward your daily quota</li>
                <li>Upgrade your plan to send more notifications per day</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
