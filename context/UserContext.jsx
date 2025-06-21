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
import useUserStore from "../lib/userStore";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const kycListenerRef = useRef(null);
  const { setUser, clearUser } = useUserStore();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[UserContext] Setting up auth listener");
    }

    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("[UserContext] Error setting persistence:", error.message);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          await user.reload();
          const userRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userRef);

          let userData = {
            id: user.uid, // Match useUserStore's expected field
            email: user.email || "",
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

          // Sync with useUserStore
          await setUser(userData);
          setCurrentUser(userData);

          // Clean up existing KYC listener
          if (kycListenerRef.current) {
            kycListenerRef.current();
            kycListenerRef.current = null;
          }

          // Set up KYC listener
          const kycDocRef = doc(db, "kycRequests", user.uid);
          kycListenerRef.current = onSnapshot(
            kycDocRef,
            async (docSnap) => {
              try {
                if (docSnap.exists()) {
                  const kycData = docSnap.data();
                  const userSnap = await getDoc(userRef);
                  const currentUserData = userSnap.exists()
                    ? userSnap.data()
                    : { isVerified: false };

                  if (
                    kycData.status === "verified" &&
                    !currentUserData.isVerified
                  ) {
                    await updateDoc(userRef, { isVerified: true });
                    const updatedUser = {
                      ...currentUserData,
                      isVerified: true,
                    };
                    await setUser(updatedUser); // Sync useUserStore
                    setCurrentUser(updatedUser); // Sync UserContext
                  }

                  if (
                    (kycData.status === "verified" ||
                      kycData.status === "rejected") &&
                    !kycData.notificationSent
                  ) {
                    try {
                      await fetch("/api/send-kyc-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: userData.email,
                          fullName: userData.fullName,
                          status: kycData.status,
                        }),
                      });
                      await updateDoc(kycDocRef, { notificationSent: true });
                    } catch (err) {
                      console.error(
                        "[UserContext] Error sending notification:",
                        err.message
                      );
                    }
                  }
                }
              } catch (error) {
                console.error(
                  "[UserContext] Error in KYC snapshot listener:",
                  error.message
                );
              }
            },
            (error) => {
              console.error(
                "[UserContext] KYC snapshot failed:",
                error.message
              );
            }
          );
        } catch (error) {
          console.error("[UserContext] Error in auth listener:", error.message);
          await clearUser();
          setCurrentUser(null);
        }
      } else {
        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }
        await clearUser();
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
  }, [setUser, clearUser]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
