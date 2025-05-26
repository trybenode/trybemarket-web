"use client"; 

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; // Adjust path to your firebaseConfig

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const kycListenerRef = useRef(null); // Store the unsubscribe function

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await user.reload();

        const userRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userRef);

        let userData = {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName || "",
          phoneNumber: user.phoneNumber || "",
          profilePicture: user.photoURL || "",
          matricNumber: "",
          address: "",
          locationType: "",
          isVerified: false,
          emailVerified: user.emailVerified,
        };

        if (docSnap.exists()) {
          userData = { ...userData, ...docSnap.data() };
        } else {
          await setDoc(userRef, userData, { merge: true });
        }

        if (user.emailVerified && !userData.emailVerified) {
          await updateDoc(userRef, { emailVerified: true });
          userData.emailVerified = true;
        }

        setCurrentUser(userData);

        // Clean up any existing KYC listener
        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }

        // Set up KYC listener
        const kycDocRef = doc(db, "kycRequests", user.uid);
        kycListenerRef.current = onSnapshot(
          kycDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const kycData = docSnap.data();

              if (kycData.status === "verified" && !currentUser?.isVerified) {
                try {
                  await updateDoc(userRef, { isVerified: true });
                  setCurrentUser((prev) => ({
                    ...prev,
                    isVerified: true,
                  }));
                } catch (error) {
                  // Only log errors in development
                  if (process.env.NODE_ENV === "development") {
                    console.error("Error updating isVerified:", error);
                  }
                }
              }
            }
          },
          (error) => {
            if (process.env.NODE_ENV === "development") {
              console.error("KYC snapshot error:", error);
            }
          }
        );
      } else {
        // Clean up KYC listener when signing out
        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }
        setCurrentUser(null);
      }
    });

    return () => {
      if (kycListenerRef.current) {
        kycListenerRef.current();
        kycListenerRef.current = null;
      }
      unsubscribeAuth();
    };
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
