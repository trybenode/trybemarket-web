"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import useUserStore from "../lib/userStore";
import { useLastSeen } from "../hooks/useLastSeen";
import { notifySignup } from "../lib/referralClient";

const UserContext = createContext();

// A cold start on a slow connection (typical of an installed app being
// launched) can make the first profile read fail; one quick retry clears most
// of those without leaving the person on a spinner.
async function getDocWithRetry(ref, attempts = 2, delayMs = 1500) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getDoc(ref);
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when someone IS signed in but their profile couldn't be loaded (slow or
  // failed network at cold start — common when an installed app launches).
  // Consumers show "try again" instead of spinning forever or treating the
  // person as logged out.
  const [profileError, setProfileError] = useState(null);
  const kycListenerRef = useRef(null);
  const loadProfileRef = useRef(null);
  const { setUser, clearUser } = useUserStore();

  // Track user's last seen timestamp automatically
  useLastSeen(currentUser?.id);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[UserContext] Setting up auth listener");
    }

    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("[UserContext] Error setting persistence:", error.message);
    });

    // Loads the signed-in person's profile into context. A named function (not
    // inline in the listener) so refreshProfile() can re-run it after a failure.
    const loadProfile = async (user) => {
      setLoading(true);
      setProfileError(null);
      try {
          try {
            await user.reload();
          } catch (reloadError) {
            // A failed refresh (flaky network) must not sign the person out or
            // block their profile — they're still authenticated.
            console.warn("[UserContext] Could not refresh auth user:", reloadError.message);
          }
          const userRef = doc(db, "users", user.uid);
          const docSnap = await getDocWithRetry(userRef);

          let userData = {
            uid: user.uid, // always present, so no consumer ever sees an undefined uid
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
            // "Missing" from a default read can also mean "couldn't reach the
            // server". Creating the profile from a bare stub over a document
            // that does exist would blank it, so confirm with the server first;
            // if that read fails it throws into the catch below (retryable).
            const confirmed = await getDocFromServer(userRef);
            if (confirmed.exists()) {
              userData = { ...userData, ...confirmed.data() };
            } else {
              await setDoc(userRef, userData, { merge: true });
              // Backstop for any signup path other than the ones that already
              // call this — best-effort, idempotent.
              notifySignup(user);
            }
          }

          if (user.emailVerified && !userData.emailVerified) {
            await updateDoc(userRef, { emailVerified: true });
            userData.emailVerified = true;
          }

          // Sync with useUserStore
          await setUser(userData);
          setCurrentUser(userData);
          setProfileError(null);

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
                    // isVerified is written server-side only (app/api/kyc-submit),
                    // atomically with the one-time KYC credit award — never
                    // client-written, so this just reflects it in local state
                    // once the kycRequests status flip confirms it happened.
                    const updatedUser = {
                      ...currentUserData,
                      isVerified: true,
                    };
                    await setUser(updatedUser); // Sync useUserStore
                    setCurrentUser(updatedUser); // Sync UserContext
                  }

                  // KYC result emails are sent by the server at decision time
                  // (app/api/kyc-submit for OCR results, app/api/admin/kyc/decision
                  // for manual ones). This used to POST the recipient's email and
                  // name to an unauthenticated /api/send-kyc-status from here — an
                  // open mail relay that let anyone send branded KYC emails to any
                  // address — and it is gone.
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
          setProfileError("We couldn't load your profile. Check your connection and try again.");
          await clearUser();
          setCurrentUser(null);
        
      }
      setLoading(false);
    };
    loadProfileRef.current = loadProfile;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadProfile(user);
      } else {
        setLoading(true);
        setProfileError(null);
        if (kycListenerRef.current) {
          kycListenerRef.current();
          kycListenerRef.current = null;
        }
        await clearUser();
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (kycListenerRef.current) {
        kycListenerRef.current();
        kycListenerRef.current = null;
      }
      unsubscribeAuth();
    };
  }, [setUser, clearUser]);

  /** Re-runs the profile load for whoever is signed in — the "Try again" button. */
  const refreshProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (user && loadProfileRef.current) await loadProfileRef.current(user);
  }, []);

  return (
    <UserContext.Provider
      value={{ currentUser, setCurrentUser, loading, profileError, refreshProfile }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
