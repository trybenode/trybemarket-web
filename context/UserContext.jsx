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
    if (process.env.NODE_ENV === "development") {
      console.log("[UserContext] Setting up auth listener");
    }
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        if (process.env.NODE_ENV === "development") {
          console.log("[UserContext] Auth persistence set to local");
        }
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[UserContext] Error setting persistence:",
            error.message
          );
        }
      });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[UserContext] onAuthStateChanged fired, user:",
          user ? user.uid : "No user"
        );
      }
      setLoading(true);
      if (user) {
        try {
          await user.reload();
          if (process.env.NODE_ENV === "development") {
            console.log("[UserContext] User reloaded, UID:", user.uid);
          }
          const userRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userRef);
          if (process.env.NODE_ENV === "development") {
            console.log("[UserContext] User doc exists:", docSnap.exists());
          }

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
            if (process.env.NODE_ENV === "development") {
              console.log("[UserContext] User data from Firestore:", userData);
            }
          } else {
            await setDoc(userRef, userData, { merge: true });
            if (process.env.NODE_ENV === "development") {
              console.log(
                "[UserContext] Created new user doc for UID:",
                user.uid
              );
            }
          }

          if (user.emailVerified && !userData.emailVerified) {
            await updateDoc(userRef, { emailVerified: true });
            userData.emailVerified = true;
            if (process.env.NODE_ENV === "development") {
              console.log("[UserContext] Updated emailVerified in Firestore");
            }
          }

          setCurrentUser(userData);
          if (process.env.NODE_ENV === "development") {
            console.log("[UserContext] Set currentUser:", userData);
          }

          if (kycListenerRef.current) {
            if (process.env.NODE_ENV === "development") {
              console.log("[UserContext] Cleaning up existing KYC listener");
            }
            kycListenerRef.current();
            kycListenerRef.current = null;
          }

          const kycDocRef = doc(db, "kycRequests", user.uid);
          if (process.env.NODE_ENV === "development") {
            console.log(
              "[UserContext] Setting up KYC listener for UID:",
              user.uid
            );
          }
          kycListenerRef.current = onSnapshot(
            kycDocRef,
            async (docSnap) => {
              if (process.env.NODE_ENV === "development") {
                console.log(
                  "[UserContext] KYC snapshot triggered for UID:",
                  user.uid
                );
              }
              try {
                if (docSnap.exists()) {
                  const kycData = docSnap.data();
                  if (process.env.NODE_ENV === "development") {
                    console.log("[UserContext] KYC data:", kycData);
                  }

                  const userSnap = await getDoc(userRef);
                  const currentUserData = userSnap.exists()
                    ? userSnap.data()
                    : { isVerified: false };
                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      "[UserContext] Current userData.isVerified:",
                      currentUserData.isVerified
                    );
                  }

                  if (
                    kycData.status === "verified" &&
                    !currentUserData.isVerified
                  ) {
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        "[UserContext] Updating isVerified to true for UID:",
                        user.uid
                      );
                    }
                    await updateDoc(userRef, { isVerified: true });
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        "[UserContext] Successfully updated isVerified in Firestore"
                      );
                    }
                    setCurrentUser((prev) => {
                      const updatedUser = { ...prev, isVerified: true };
                      if (process.env.NODE_ENV === "development") {
                        console.log(
                          "[UserContext] Updated currentUser state:",
                          updatedUser
                        );
                      }
                      return updatedUser;
                    });
                  } else {
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        "[UserContext] KYC update skipped: status=",
                        kycData.status,
                        ", isVerified=",
                        currentUserData.isVerified
                      );
                    }
                  }

                  if (
                    (kycData.status === "verified" ||
                      kycData.status === "rejected") &&
                    !kycData.notificationSent
                  ) {
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        "[UserContext] Sending KYC status notification"
                      );
                    }
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
                      if (process.env.NODE_ENV === "development") {
                        console.log(
                          "[UserContext] Notification sent and notificationSent updated"
                        );
                      }
                    } catch (err) {
                      if (process.env.NODE_ENV === "development") {
                        console.error(
                          "[UserContext] Error sending notification:",
                          err.message
                        );
                      }
                    }
                  }
                } else {
                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      "[UserContext] No KYC request found for UID:",
                      user.uid
                    );
                  }
                }
              } catch (error) {
                if (process.env.NODE_ENV === "development") {
                  console.error(
                    "[UserContext] Error in KYC snapshot listener:",
                    error.message
                  );
                }
              }
            },
            (error) => {
              if (process.env.NODE_ENV === "development") {
                console.error(
                  "[UserContext] KYC snapshot failed:",
                  error.message,
                  ", code:",
                  error.code
                );
              }
            }
          );
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error(
              "[UserContext] Error in auth listener:",
              error.message
            );
          }
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("[UserContext] No user, clearing state");
        }
        if (kycListenerRef.current) {
          if (process.env.NODE_ENV === "development") {
            console.log("[UserContext] Cleaning up KYC listener");
          }
          kycListenerRef.current();
          kycListenerRef.current = null;
        }
        setCurrentUser(null);
      }
      setLoading(false);
      if (process.env.NODE_ENV === "development") {
        console.log("[UserContext] Auth listener setup complete");
      }
    });

    return () => {
      if (process.env.NODE_ENV === "development") {
        console.log("[UserContext] Cleaning up auth listener");
      }
      if (kycListenerRef.current) {
        if (process.env.NODE_ENV === "development") {
          console.log("[UserContext] Cleaning up KYC listener");
        }
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
