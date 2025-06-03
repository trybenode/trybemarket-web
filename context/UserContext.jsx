// context/UserContext.js
"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const kycListenerRef = useRef(null);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log("Auth persistence set to local"))
      .catch((error) => console.error("Error setting persistence:", error));

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log(
        "UserContext auth state:",
        user ? `User: ${user.uid}` : "No user"
      );
      setLoading(true);
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

        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }

        const kycDocRef = doc(db, "kycRequests", user.uid);
        kycListenerRef.current = onSnapshot(
          kycDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const kycData = docSnap.data();
              console.log("KYC data:", kycData);

              // Only proceed if notification hasn't been sent
              if (
                (kycData.status === "verified" ||
                  kycData.status === "rejected") &&
                !kycData.notificationSent
              ) {
                const status = kycData.status;
                try {
                  // Send email notification
                  await fetch("/api/send-kyc-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: userData.email,
                      fullName: userData.fullName,
                      status,
                    }),
                  });

                  // Update Firestore to mark notification as sent
                  await updateDoc(kycDocRef, { notificationSent: true });

                  if (status === "verified" && !userData.isVerified) {
                    await updateDoc(userRef, { isVerified: true });
                    setCurrentUser((prev) => ({ ...prev, isVerified: true }));
                  }
                } catch (err) {
                  console.error("Error notifying KYC:", err);
                }
              }
            } else {
              console.log("No KYC request found for UID:", user.uid);
            }
          },
          (error) => {
            console.error("KYC snapshot error:", error);
          }
        );
      } else {
        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }
        setCurrentUser(null);
      }
      setLoading(false);
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
    <UserContext.Provider value={{ currentUser, setCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
