// app/edit-profile/page.jsx
"use client";

import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { validatePhone, convertToInternationalFormat } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Camera, Check, Mail, MessageSquare } from "lucide-react";
import { useUser } from "../../context/UserContext";
import toast from "react-hot-toast"; // Using react-hot-toast
import Header from "@/components/Header";

export default function EditProfilePage() {
  const { currentUser, setCurrentUser, loading: authLoading, profileError, refreshProfile } = useUser();
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
  // Promotional messages ("Offers & updates") — separate from message alerts.
  // WhatsApp promos need an explicit opt-in; email promos are on unless the
  // person unsubscribed.
  const [whatsappMarketing, setWhatsappMarketing] = useState(false);
  const [emailMarketing, setEmailMarketing] = useState(true);

  // The signed-in user's Firestore id. Only ever read after the profile has
  // loaded (see the guards below); never assume `.uid` exists on the object.
  const userId = currentUser?.uid || currentUser?.id;

  // Not signed in (and not still finding out) -> go to login instead of spinning forever.
  useEffect(() => {
    if (!authLoading && !currentUser && !profileError) router.push("/login");
  }, [authLoading, currentUser, profileError, router]);

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
      setWhatsappMarketing(currentUser.whatsappMarketing === true);
      setEmailMarketing(currentUser.marketingEmailOptOut !== true);
      
      setIsFetching(false);
    }
  }, [currentUser]);


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
    if (!userId) {
      toast.error("Your profile hasn't finished loading. Please try again in a moment.");
      return;
    }
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

      const userRef = doc(db, "users", userId);
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
    // Validate phone if WhatsApp alerts or WhatsApp offers are enabled
    if ((whatsappNotifications || whatsappMarketing) && phone) {
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
    if (whatsappMarketing && !phone) {
      toast.error("Please enter a valid phone number to get offers on WhatsApp");
      return;
    }

    if (!userId) {
      toast.error("Your profile hasn't finished loading. Please try again in a moment.");
      return;
    }

    setSavingNotifications(true);
    try {
      const now = new Date().toISOString();
      const wantsWhatsappMarketing = whatsappMarketing && phone ? true : false;
      const hadWhatsappMarketing = currentUser?.whatsappMarketing === true;
      const hadEmailOptOut = currentUser?.marketingEmailOptOut === true;

      const notificationData = {
        phone: phone ? convertToInternationalFormat(phone) : null,
        emailNotifications,
        whatsappNotifications: whatsappNotifications && phone ? true : false,
        whatsappMarketing: wantsWhatsappMarketing,
        marketingEmailOptOut: !emailMarketing,
        // When and where consent was given or withdrawn, only on a change.
        ...(wantsWhatsappMarketing && !hadWhatsappMarketing
          ? { whatsappMarketingAt: now, whatsappMarketingSource: "edit_profile" }
          : {}),
        ...(!wantsWhatsappMarketing && hadWhatsappMarketing
          ? { whatsappMarketingOptOutAt: now }
          : {}),
        ...(!emailMarketing && !hadEmailOptOut
          ? { marketingEmailOptOutAt: now, marketingEmailOptOutSource: "edit_profile" }
          : {}),
      };

      const userRef = doc(db, "users", userId);
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

  // The profile couldn't be loaded (network) — say so and let them retry.
  if (!authLoading && !currentUser && profileError) {
    return (
      <div className='min-h-screen bg-slate-50 flex items-center justify-center px-6'>
        <div className='flex flex-col items-center text-center max-w-sm'>
          <p className='text-gray-800 font-medium'>{profileError}</p>
          <Button className='mt-4' onClick={refreshProfile}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Loading state — wait for the auth/profile load itself, not just the form.
  if (authLoading || isFetching) {
    return (
      <div className='min-h-screen bg-slate-50 flex items-center justify-center'>
        <div className='flex flex-col items-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
          <p className='mt-4 text-gray-600'>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Profile & Settings" />

      <div className="mx-auto max-w-md space-y-4 px-4 pb-10 pt-4">
        {/* Profile */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-yellow-soft shadow ring-2 ring-white">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-slate-700">{(name || "?").trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
              <label
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-white ring-2 ring-white transition hover:bg-primary/90"
                aria-label="Change profile photo"
              >
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={loading} />
              </label>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{name || "Your name"}</p>
              <p className="truncate text-xs text-slate-500">{currentUser?.email}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Field id="fullName" label="Full name">
              <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" disabled={loading} />
            </Field>
            <Field id="matricNumber" label="Matric number">
              <Input
                id="matricNumber"
                value={matricNum}
                onChange={(e) => setMatricNum(e.target.value)}
                placeholder="LCU/UG/XX/XXXX"
                disabled={loading}
              />
            </Field>
            <Field label="Where you stay">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["hostelite", "Hostel"],
                  ["non-hostelite", "Off campus"],
                ].map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected(value)}
                    disabled={loading}
                    aria-pressed={selected === value}
                    className={`h-10 rounded-xl border text-sm font-medium transition ${
                      selected === value ? "border-primary bg-blue-50 text-primary" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </Field>
            <Field id="moreInfo" label="Address details" hint="So buyers know where to meet you.">
              <Input
                id="moreInfo"
                value={moreInfo}
                onChange={(e) => setMoreInfo(e.target.value)}
                placeholder={selected === "hostelite" ? "Hostel name and room number" : "Area or nearest landmark"}
                disabled={loading}
              />
            </Field>
          </div>

          <Button onClick={handleSaveProfile} disabled={loading} className="mt-4 w-full">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                Saving…
              </>
            ) : (
              "Save profile"
            )}
          </Button>
        </section>

        {/* Notifications */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Bell className="h-4 w-4 text-primary" /> Message alerts
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">How we tell you about new messages while you're away.</p>

          <div className="mt-2 divide-y divide-slate-100">
            <ToggleRow
              id="email-notifications"
              Icon={Mail}
              title="Email"
              text="To your account email"
              checked={emailNotifications}
              onChange={setEmailNotifications}
              disabled={savingNotifications}
            />
            <ToggleRow
              id="whatsapp-notifications"
              Icon={MessageSquare}
              iconClass="text-green-600"
              title="WhatsApp"
              text="To the number below"
              checked={whatsappNotifications}
              onChange={setWhatsappNotifications}
              disabled={savingNotifications}
            />
          </div>

          <Field id="phone" label="WhatsApp number" hint={phoneError ? null : "Nigerian number, e.g. 08012345678"} className="mt-2">
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="08012345678"
              value={phone}
              onChange={handlePhoneChange}
              className={phoneError ? "border-red-500" : ""}
              disabled={savingNotifications}
            />
            {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
          </Field>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Offers &amp; updates</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Campus deals, new features and news from TrybeMarket. Separate from message alerts. Turn off any time.
          </p>
          <div className="mt-1 divide-y divide-slate-100">
            <ToggleRow
              id="whatsapp-marketing"
              Icon={MessageSquare}
              iconClass="text-green-600"
              title="On WhatsApp"
              text="To the number above"
              checked={whatsappMarketing}
              onChange={setWhatsappMarketing}
              disabled={savingNotifications}
            />
            <ToggleRow
              id="email-marketing"
              Icon={Mail}
              title="By email"
              text="To your account email"
              checked={emailMarketing}
              onChange={setEmailMarketing}
              disabled={savingNotifications}
            />
          </div>

          <Button
            onClick={handleSaveNotifications}
            disabled={savingNotifications || ((whatsappNotifications || whatsappMarketing) && phoneError)}
            className="mt-4 w-full"
          >
            {savingNotifications ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                Saving…
              </>
            ) : (
              <>
                <Check /> Save notification settings
              </>
            )}
          </Button>

          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            Alerts go out when you message someone who's offline, and each one counts toward your daily limit: 5 a day
            on the free plan, more on paid plans.
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({ id, label, hint, className = "", children }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function ToggleRow({ id, Icon, iconClass = "text-primary", title, text, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          <Icon className={`h-4 w-4 ${iconClass}`} />
        </span>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium text-slate-900">
            {title}
          </Label>
          <p className="text-xs text-slate-500">{text}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
