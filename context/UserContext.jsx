// context/UserContext.js
"use client"

import React, { createContext, useState, useContext, useEffect, useRef } from "react"
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth"
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore"
import { auth, db } from "../lib/firebase"

const UserContext = createContext()

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true) // Add loading state
  const kycListenerRef = useRef(null)

  useEffect(() => {
    // Set auth persistence
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log("Auth persistence set to local"))
      .catch((error) => console.error("Error setting persistence:", error))

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("UserContext auth state:", user ? `User: ${user.uid}` : "No user")
      setLoading(true) // Ensure loading is true during auth check
      if (user) {
        await user.reload()
        const userRef = doc(db, "users", user.uid)
        const docSnap = await getDoc(userRef)

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
        }

        if (docSnap.exists()) {
          userData = { ...userData, ...docSnap.data() }
        } else {
          await setDoc(userRef, userData, { merge: true })
        }

        if (user.emailVerified && !userData.emailVerified) {
          await updateDoc(userRef, { emailVerified: true })
          userData.emailVerified = true
        }

        setCurrentUser(userData)

        // Clean up existing KYC listener
        if (kycListenerRef.current) {
          kycListenerRef.current()
          kycListenerRef.current = null
        }

        // Set up KYC listener
        const kycDocRef = doc(db, "kycRequests", user.uid)
        kycListenerRef.current = onSnapshot(
          kycDocRef,
          async (docSnap) => {
            if (docSnap.exists()) {
              const kycData = docSnap.data()
              console.log("KYC data:", kycData)
              if (kycData.status === "verified" && !userData.isVerified) {
                try {
                  await updateDoc(userRef, { isVerified: true })
                  setCurrentUser((prev) => ({
                    ...prev,
                    isVerified: true,
                  }))
                  console.log("Updated isVerified to true")
                } catch (error) {
                  console.error("Error updating isVerified:", error)
                }
              }
            } else {
              console.log("No KYC request found for UID:", user.uid)
            }
          },
          (error) => {
            console.error("KYC snapshot error:", error)
          }
        )
      } else {
        if (kycListenerRef.current) {
          kycListenerRef.current()
          kycListenerRef.current = null
        }
        setCurrentUser(null)
      }
      setLoading(false) // Clear loading after auth state is resolved
    })

    return () => {
      if (kycListenerRef.current) {
        kycListenerRef.current()
        kycListenerRef.current = null
      }
      unsubscribeAuth()
    }
  }, [])

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)