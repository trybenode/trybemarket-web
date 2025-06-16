import { useState, useEffect } from "react";
import { collection, doc, getDoc, getDocs, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { compressImage } from "@/utils/compressImage";

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
  const [selectedAvailability, setSelectedAvailability] = useState(true);
  const [images, setImages] = useState([]);
  const [isAgreed, setIsAgreed] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.push("/login");
    } else if (!currentUser.isVerified) {
      setOpenVerificationDialog(true);
    }
    setIsLoading(false);
  }, [currentUser]);

  useEffect(() => {
    const fetchServiceCategory = async () => {
      try {
        const snapShot = await getDocs(collection(db, "serviceCategories"));
        const serviceCategoryData = snapShot.docs.map((doc) => ({
          label: doc.data().name,
          value: doc.data().name,
        }));
        if (serviceCategoryData.length === 0) {
          setCategory([{ label: "Test Category", value: "test-cat" }]);
        } else {
          setCategory(serviceCategoryData);
        }
      } catch (error) {
        toast.error("🔥 Error fetching categories:", error);
        setCategory([{ label: "Test Category", value: "test-cat" }]); 
      }

      // setCategory(serviceCategoryData);
    };
    fetchServiceCategory();
  }, []);

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
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
    
    if (
      !serviceName ||
      !selectedCategory ||
      !serviceDescription ||
      !price ||
      !selectedAvailability ||
      images.length === 0
    ) {
      toast.error("Fill all fields & add images");
      return;
    }

    try {
      setSaving(true);
      const userId = auth.currentUser?.uid;
      const userSnap = await getDoc(doc(db, "users", userId));
      const university = userSnap.data()?.selectedUniversity || "Unknown";

      const data = {
        name: serviceName.trim(),
        categoryId: selectedCategory,
        description: serviceDescription.trim(),
        price: parseFloat(price),
        availability: selectedAvailability,
        images,
        userId,
        university,
        createdAt: new Date(),
      };

      await addDoc(collection(db, "services"), data);
      toast.success("Service Listed Successfully");
      setTimeout(() => router.push("/explore"), 1000);
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
    selectedAvailability,
    setSelectedAvailability,
    images,
    setImages,
    isAgreed,
    setIsAgreed,
    handleImageUpload,
    handleSubmit,
  };
};
