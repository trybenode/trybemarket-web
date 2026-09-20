import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import useUserStore from "@/lib/userStore";

// Firestore queues a write while the connection is down and waits for it to
// come back, so an unguarded save would sit on "Saving…" forever. If it takes
// this long we stop waiting, tell the person, and let them retry; the queued
// write still completes on its own once they're back online.
const SAVE_TIMEOUT_MS = 12000;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

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

  /** @returns {Promise<boolean>} true if the choice was saved (and we're heading home), false if it failed */
  const handleSelectUniversity = async (university) => {
    if (isSelecting) return false;

    setIsSelecting(true);
    try {
      await withTimeout(setUniversity(university), SAVE_TIMEOUT_MS);
      toast.success(`Selected ${university}`);
      router.push("/");
      return true;
    } catch (err) {
      console.error(err);
      toast.error(
        err?.message === "timeout"
          ? "Saving is taking longer than usual. Check your connection and try again."
          : "Couldn't save your university. Please try again."
      );
      return false;
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
