import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import useUserStore from "@/lib/userStore";

const useUniversitySelection = () => {
  const router = useRouter();
  const { user, selectedUniversity, isFirstTimeUser, setUniversity, isReady } =
    useUserStore();
  const [universities, setUniversities] = useState([]);
  const [filteredUniversities, setFilteredUniversities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch universities from the HipoLabs API
  useEffect(() => {
    const fetchUniversities = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "http://universities.hipolabs.com/search?country=Nigeria"
        );
        if (!response.ok) throw new Error("Failed to fetch universities");
        const data = await response.json();

        // Transform to clean up university names (remove brackets)
        const transformedData = data.map((uni) => {
          const rawName = uni.name;
          const cleanedName = rawName.replace(/\s*\([^)]*\)\s*/g, "").trim();
          // console.log("Raw:", rawName, "→ Cleaned:", cleanedName);

          return {
            name: cleanedName,
            domain: uni.domains?.[0] || "",
            website: uni.web_pages?.[0] || "",
          };
        });

        setUniversities(transformedData);
        setFilteredUniversities(transformedData);
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load universities: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUniversities();
  }, []);

  // Filter universities based on search query
  useEffect(() => {
    const filtered = universities.filter((uni) =>
      uni.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUniversities(filtered);
  }, [searchQuery, universities]);

  // Handle university selection
  const handleSelectUniversity = async (university) => {
    try {
      await setUniversity(university);
      toast.success(`Selected ${university.name}`);
      router.push("/"); // Redirect to home page after selection
    } catch (err) {
      toast.error("Failed to save university selection");
    }
  };

  // Redirect first-time users to select-university page
  useEffect(() => {
    if (isReady() && user && isFirstTimeUser && !selectedUniversity) {
      router.push("/select-university");
    }
  }, [user, isFirstTimeUser, selectedUniversity, router, isReady]);

  return {
    universities: filteredUniversities,
    searchQuery,
    setSearchQuery,
    loading,
    error,
    handleSelectUniversity,
    isFirstTimeUser,
    selectedUniversity,
  };
};

export default useUniversitySelection;
