"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Head from "next/head";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-hot-toast"; // Updated import
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import useUserStore from "@/lib/userStore";
import useUniversitySelection from "@/hooks/useUniversitySelection";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  // Initialize user store
  useEffect(() => {
    useUserStore.getState().loadUser();
  }, []);

  // In LoginPage.js
  const handleLogin = async (e) => {
    e.preventDefault();

    const { initError, isInitialized } = useUserStore.getState();
    if (!isInitialized) {
      toast.error(
        "Store Not Initialized: User store is still loading. Please try again."
      );
      return;
    }
    if (initError) {
      toast.error(
        "Initialization Error: Failed to initialize user data. Please try again."
      );
      return;
    }

    if (!email || !password) {
      toast.error("Missing Fields: Please fill in both email and password.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Invalid Email: Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      if (!user.emailVerified) {
        toast.error(
          "Email Not Verified: Please verify your email before logging in."
        );
        await auth.signOut();
        return;
      }

      await useUserStore.getState().setUser({
        id: user.uid,
        email: user.email,
      });

      toast.success("Login Successful: Welcome back!", {
        position: "top-center",
        duration: 3000,
      });

      // Use selectedUniversity from store for redirect
      const { selectedUniversity } = useUserStore.getState();
      router.push(selectedUniversity ? "/" : "/select-university");
    } catch (error) {
      console.error("Login error:", error.message);
      let errorMessage = "Failed to login. Please try again.";
      switch (error.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          errorMessage = "Invalid email or password";
          break;
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address";
          break;
        case "auth/too-many-requests":
          errorMessage =
            "Too many failed login attempts. Please try again later.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
      }
      toast.error(`Login Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log("Starting Google Sign-In");
    if (isGoogleSigningIn) {
      console.log("Google Sign-In already in progress");
      return;
    }
    setIsGoogleSigningIn(true);

    const { initError, isInitialized } = useUserStore.getState();
    if (!isInitialized) {
      toast.error(
        "Store Not Initialized: User store is still loading. Please try again."
      );
      setIsGoogleSigningIn(false);
      return;
    }
    if (initError) {
      toast.error(
        "Initialization Error: Failed to initialize user data. Please try again."
      );
      setIsGoogleSigningIn(false);
      return;
    }

    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          fullName: user.displayName,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          profilePicture: user.photoURL,
        },
        { merge: true }
      );

      await useUserStore.getState().setUser({
        id: user.uid,
        email: user.email,
        fullName: user.displayName,
        profilePicture: user.photoURL,
      });

      toast.success(`Login Successful: Welcome ${user.displayName}`, {
        position: "top-center",
        duration: 3000,
      });

      // Use selectedUniversity from store for redirect
      const { selectedUniversity } = useUserStore.getState();
      router.push(selectedUniversity ? "/" : "/select-university");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      let errorMessage = "Something went wrong";
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Google Sign-In popup was closed";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Sign-in was cancelled";
      }
      toast.error(`Google Sign-In Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setIsGoogleSigningIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Missing Email: Please enter your email first.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(
        "Reset Email Sent: If this email is registered, you will receive reset instructions."
      );
    } catch (error) {
      console.error("Forgot Password Error:", error.message);
      toast.success(
        "Reset Email Sent: If this email is registered, you will receive reset instructions."
      );
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-2'>
      <Head>
        <title>Login - Trybe Market</title>
        <meta
          name='description'
          content='Log in to your Trybe Market account to continue buying and selling.'
        />
      </Head>
      <Card className='w-full max-w-md shadow-md p-2'>
        <CardHeader className='space-y-1 items-center'>
          <div className='w-40 h-20 relative mb-2'>
            <Image
              src='/assets/logo.png'
              alt='App Logo'
              fill
              className='object-contain'
            />
          </div>
          <CardTitle className='text-2xl font-bold'>
            Welcome back Hustler
          </CardTitle>
          <CardDescription>Login to your account to continue</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className='space-y-4'>
            <div className='space-y-2'>
              <div className='relative'>
                <Mail className='absolute left-3 top-3 h-4 w-4 text-gray-400' />
                <Input
                  type='email'
                  placeholder='Email'
                  className='pl-10'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-label='Email Input'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <div className='relative'>
                <Lock className='absolute left-3 top-3 h-4 w-4 text-gray-400' />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder='Password'
                  className='pl-10 pr-10'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-label='Password Input'
                />
                <button
                  type='button'
                  className='absolute right-3 top-3 text-gray-400 hover:text-gray-600'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </button>
              </div>
              <div className='text-right'>
                <button
                  type='button'
                  onClick={handleForgotPassword}
                  className='text-sm text-blue-600 hover:underline'
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type='submit'
              className='w-full bg-blue-600 hover:bg-blue-700'
              disabled={loading}
              aria-label='Login Button'
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className='mt-6 flex items-center justify-center'>
            <Separator className='flex-grow' />
            <span className='mx-4 text-sm text-gray-500'>OR</span>
            <Separator className='flex-grow' />
          </div>

          <Button
            variant='outline'
            className='w-full mt-4 flex items-center justify-center gap-2'
            onClick={handleGoogleLogin}
            disabled={loading || isGoogleSigningIn}
            aria-label='Sign in with Google'
          >
            <svg className='h-5 w-5' viewBox='0 0 24 24'>
              <path
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                fill='#4285F4'
              />
              <path
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                fill='#34A853'
              />
              <path
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                fill='#FBBC05'
              />
              <path
                d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                fill='#EA4335'
              />
              <path d='M1 1h22v22H1z' fill='none' />
            </svg>
            Sign in with Google
          </Button>
        </CardContent>

        <CardFooter className='flex justify-center'>
          <p className='text-sm text-gray-600'>
            Don't have an account?{" "}
            <Link
              href='/signup'
              className='text-blue-600 hover:underline font-medium'
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
