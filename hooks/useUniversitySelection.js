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

  // New: track if selection is in progress
  const [isSelecting, setIsSelecting] = useState(false);

  // Fetch universities once
  useEffect(() => {
    const fetchUniversities = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          "http://universities.hipolabs.com/search?country=Nigeria"
        );
        if (!res.ok) throw new Error("Failed to fetch universities");
        const data = await res.json();

        const cleaned = data.map((uni) =>
          uni.name.replace(/\s*\([^)]*\)\s*/g, "").trim()
        );
        setUniversities(cleaned);
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load universities: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchUniversities();
  }, []);

  // Filtered universities based on search query
  const filteredUniversities = universities.filter((uni) =>
    uni.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUniversity = async (university) => {
    if (isSelecting) return; // block if already selecting

    setIsSelecting(true);
    try {
      await setUniversity(university); // updates store and Firestore
      toast.success(`Selected ${university}`);
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save university selection");
    } finally {
      setIsSelecting(false);
    }
  };

  // Redirect first-time users who haven't selected a university
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
    isSelecting, // expose this flag
    isFirstTimeUser: isFirstTimeUser(),
    selectedUniversity,
  };
};

export default useUniversitySelection;
