import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import useUserStore from "@/lib/userStore";

const useUniversitySelection = () => {
  const router = useRouter();
  const { user, selectedUniversity, isFirstTimeUser, setUniversity, isReady } =
    useUserStore();

  const [universities, setUniversities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    const fetchUniversities = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/universities.json");
        if (!res.ok) throw new Error("Failed to load local university list");
        const data = await res.json();
        setUniversities(data);
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load universities: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUniversities();
  }, []);

  const filteredUniversities = universities.filter((uni) =>
    uni.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUniversity = async (university) => {
    if (isSelecting) return;

    setIsSelecting(true);
    try {
      await setUniversity(university);
      toast.success(`Selected ${university}`);
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save university selection");
    } finally {
      setIsSelecting(false);
    }
  };

  useEffect(() => {
    if (isReady() && user && isFirstTimeUser() && !selectedUniversity) {
      router.push("/select-university");
    }
  }, [user, selectedUniversity, router, isReady, isFirstTimeUser]);

  return {
    universities: filteredUniversities,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    handleSelectUniversity,
    isSelecting,
    isFirstTimeUser: isFirstTimeUser(),
    selectedUniversity,
  };
};

export default useUniversitySelection;
