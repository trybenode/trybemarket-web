import { useState, useEffect } from "react";
import { collection, doc, getDoc, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { compressImage } from "@/utils/compressImage";
import serviceCategories from "@/public/serviceCategories.json";
import { canUserUploadService } from "@/hooks/UploadLimiter";

export const useServiceForm = (currentUser) => {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openVerificationDialog, setOpenVerificationDialog] = useState(false);
  const [category, setCategory] = useState([]);
  const [serviceName, setServiceName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [price, setPrice] = useState("");
  const [availabilityType, setAvailabilityType] = useState("on_contact");
  const [availabilityStart, setAvailabilityStart] = useState("");
  const [availabilityEnd, setAvailabilityEnd] = useState("");
  const [images, setImages] = useState([]);
  const [isAgreed, setIsAgreed] = useState(false);

  // Check user authentication and verification
  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
    } else if (!currentUser.isVerified) {
      setOpenVerificationDialog(true);
    }
    setIsLoading(false);
  }, [currentUser]);

  // Load and transform categories from serviceCategories.json
  useEffect(() => {
    try {
      // Transform data to { label, value } format
      const transformedCategories = serviceCategories.map((item) => {
        // Handle both { name: string } and { label: string, value: string } formats
        const label = item.label || item.name;
        const value =
          item.value ||
          item.name
            .toLowerCase()
            .replace(/ & /g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/\s+/g, "-");
        return { label, value };
      });

      if (transformedCategories.length === 0) {
        setCategory([{ label: "Test Category", value: "test-cat" }]);
        toast.error("No categories found in serviceCategories.json");
      } else {
        setCategory(transformedCategories);
      }
    } catch (error) {
      toast.error(`Error loading categories: ${error.message}`);
      setCategory([{ label: "Test Category", value: "test-cat" }]);
    }
  }, []);

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const arr = Array.from(files);
    try {
      const urls = await Promise.all(
        arr.map(async (file) => {
          const compressed = await compressImage(file);
          const data = new FormData();
          data.append("file", compressed);
          data.append("upload_preset", "ProductImage");
          data.append("cloud_name", "dj21x4jnt");
          data.append("folder", "market_trybe_products");

          const res = await fetch(
            "https://api.cloudinary.com/v1_1/dj21x4jnt/image/upload",
            { method: "POST", body: data }
          );
          const json = await res.json();
          if (!json.secure_url) throw new Error("Upload failed");
          return json.secure_url;
        })
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form fields
    if (
      !serviceName ||
      !selectedCategory ||
      !serviceDescription ||
      !price ||
      !availabilityType ||
      images.length === 0
    ) {
      toast.error("Fill all required fields & add images");
      return;
    }

    // Validate specific timeframe if selected
    if (availabilityType === "specific_time") {
      if (!availabilityStart || !availabilityEnd) {
        toast.error("Please provide both start and end times.");
        return;
      }
      // Compare times assuming same day
      const [startHours, startMinutes] = availabilityStart
        .split(":")
        .map(Number);
      const [endHours, endMinutes] = availabilityEnd.split(":").map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      if (endTotalMinutes <= startTotalMinutes) {
        toast.error("End time must be after start time.");
        return;
      }
    }

    try {
      setSaving(true);
      const userId = auth.currentUser?.uid;

      // Check if user can upload more services
      const uploadCheck = await canUserUploadService(userId);
      if (!uploadCheck.canUpload) {
        toast.error(uploadCheck.message);
        setSaving(false);
        // Redirect to subscription page after 2 seconds
        setTimeout(() => {
          router.push("/subscription");
        }, 2000);
        return;
      }

      const userSnap = await getDoc(doc(db, "users", userId));
      const university = userSnap.data()?.selectedUniversity || "Unknown";

      // Prepare availability data
      const availability = {
        type: availabilityType,
        ...(availabilityType === "specific_time" && {
          start: availabilityStart, // e.g., "14:30"
          end: availabilityEnd, // e.g., "16:30"
        }),
      };

      const data = {
        name: serviceName.trim(),
        categoryId: selectedCategory,
        description: serviceDescription.trim(),
        price: parseFloat(price),
        availability,
        images,
        userId,
        university,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "services"), data);
      toast.success("Service Listed Successfully");
      router.push("/explore-services");
      // setTimeout(() => , 1000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return {
    isLoading,
    saving,
    openVerificationDialog,
    setOpenVerificationDialog,
    category,
    serviceName,
    setServiceName,
    selectedCategory,
    setSelectedCategory,
    serviceDescription,
    setServiceDescription,
    price,
    setPrice,
    availabilityType,
    setAvailabilityType,
    availabilityStart,
    setAvailabilityStart,
    availabilityEnd,
    setAvailabilityEnd,
    images,
    setImages,
    isAgreed,
    setIsAgreed,
    handleImageUpload,
    handleSubmit,
  };
};
