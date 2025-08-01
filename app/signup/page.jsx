"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Head from "next/head";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "react-hot-toast";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useUserStore from "@/lib/userStore";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  // Initialize user store
  useEffect(() => {
    useUserStore.getState().loadUser();
  }, []);

  const handleSignUp = async (e) => {
    e.preventDefault();

    const { isReady, initError } = useUserStore.getState();
    if (!isReady()) {
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

    if (!email || !fullName || !password) {
      toast.error("Incomplete Fields: Please fill in all fields to continue.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error("Invalid Email: Please enter a valid email address.");
      return;
    }

    if (!checked) {
      toast.error(
        "Terms & Conditions: Please agree to the Terms & Conditions to continue."
      );
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await sendEmailVerification(user);

      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        fullName,
        isVerified: false,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      });

      await useUserStore.getState().setUser({
        id: user.uid,
        email: user.email,
        fullName,
      });

      // Ensure store is initialized and check for errors
      const {
        selectedUniversity,
        isInitialized,
        initError: storeError,
      } = useUserStore.getState();
      if (!isInitialized) {
        toast.error("Store not fully initialized. Please try again.");
        return;
      }
      if (storeError) {
        toast.error(
          "Failed to load user data from Firestore. Please try again."
        );
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("Selected University after signup:", selectedUniversity);
      }

      toast.success(
        "Account Created 🎉: A verification email has been sent. Please verify your email and log in.",
        {
          position: "top-center",
          duration: 3000,
        }
      );

      await auth.signOut();
      // Redirect to login page
      router.push("/login");
    } catch (err) {
      console.error("Sign up error:", err.message);
      let errorMessage = "Something went wrong. Please try again.";

      switch (err.code) {
        case "auth/email-already-in-use":
          errorMessage =
            "This email is already registered. Please login or use another email.";
          break;
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address.";
          break;
        case "auth/weak-password":
          errorMessage = "Password should be at least 6 characters.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
      }

      toast.error(`Sign Up Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    console.log("Starting Google Sign-Up");
    if (isGoogleSigningIn) {
      console.log("Google Sign-Up already in progress");
      return;
    }
    setIsGoogleSigningIn(true);

    const { isReady, initError } = useUserStore.getState();
    if (!isReady()) {
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

      // Ensure store is initialized and check for errors
      const {
        selectedUniversity,
        isInitialized,
        initError: storeError,
      } = useUserStore.getState();
      if (!isInitialized) {
        toast.error("Failed. Please try again.");
        return;
      }
      if (storeError) {
        toast.error(
          "Failed to load user data from Firestore. Please try again."
        );
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          "Selected University after Google signup:",
          selectedUniversity
        );
      }

      toast.success(`Sign Up Successful 🎉: Welcome ${user.displayName}`, {
        position: "top-center",
        duration: 3000,
      });

      // Redirect based on selectedUniversity
      router.push(selectedUniversity ? "/" : "/select-university");
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      let errorMessage = "Something went wrong";
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Google Sign-In popup was closed";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Sign-in was cancelled";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      }
      toast.error(`Google Sign-In Failed: ${errorMessage}`);
    } finally {
      setLoading(false);
      setIsGoogleSigningIn(false);
    }
  };

  const termsParagraphs = [
    "1. Introduction: Welcome to TrybeMarket ! By accessing or using our platform, you agree to comply with these Terms & Conditions.",
    "2. Eligibility: You must be at least 16 years old and a verified university student. Providing false information or fraudulent activity may lead to suspension or termination.",
    "3. Your Account: Keep your credentials safe. You are responsible for all activities under your account. TrybeMarket  is not responsible for unauthorized access.",
    "4. User Conduct: Post only genuine products/services. No illegal, restricted, misleading, fake listings, scams, hate speech, or fraudulent behavior. Violations may lead to suspension.",
    "5. Buying & Selling: TrybeMarket  connects buyers & sellers but does not guarantee transactions. Verify products/services before payment. Prefer in-app communication and transactions for safety.",
    "6. Payments & Subscriptions: Some features require a subscription or service fee. Payments processed via Paystack, Flutterwave, etc. We do not store card details. Refunds only issued for failures directly caused by TrybeMarket .",
    "7. Content Ownership & IP: Users retain ownership of uploaded content. By posting, you grant TrybeMarket  a non‑exclusive license to display, promote, and use it. Unauthorized copying of others’ content or our IP (name, logo, design) is prohibited.",
    "8. Limitation of Liability: TrybeMarket  is not liable for buyer‑seller disputes, product/service quality issues, delivery problems, or off-platform transactions.",
    "9. Suspension & Termination: We may suspend or terminate accounts that violate these Terms without prior notice.",
    "10. Changes to Terms: We may update these Terms. Substantial changes will be communicated via the app or email. Continued use indicates acceptance.",
    "11. Model Training & AI Use: By using TrybeMarket, you acknowledge and consent that anonymized or aggregated data (e.g., usage patterns, metadata) may be used to train or fine‑tune our in‑house AI models, provided data cannot be traced to individuals.",
    "12. Prohibition of External AI Use: You agree not to use TrybeMarket content (e.g., listings, chat logs) to train external AI or machine learning systems unless you obtain explicit written consent from TrybeMarket.",
    "13. Opt‑Out & Consent: At any time, you may withdraw consent for your data to be used in AI training. After opting out, your data will no longer be included in future model training/analysis.",
  ];

  const privacyParagraphs = [
    "1. Information We Collect: Personal Info (name, email, phone, school, department, profile photo, student ID card); Account Info (login/auth via Firebase); Listings (including images via Cloudinary); Device Info (IP, device type, OS); Payment Info (via third-party processors; no card data is stored).",
    "2. How We Use Your Information: To manage accounts, facilitate buying/selling, perform basic KYC, send updates/promotions, detect fraud, and enhance security.",
    "3. Legal Basis for Processing: Based on Consent (withdrawable at any time), Contract necessity, Legitimate interests (e.g. fraud prevention, analytics), and Legal compliance under NDPA.",
    "4. Data Sharing: We do not sell/rent data. Shared only with payment processors (Paystack, Flutterwave, Opay), service providers (Firebase, Cloudinary), and law enforcement when legally required.",
    "5. Data Security: We implement strong safeguards (e.g. Firebase security standards). No system is 100% secure—users are responsible for protecting login credentials.",
    "6. Your Rights (NDPA-Aligned): Access, correct, delete personal data; restrict or object to processing; withdraw consent; data portability; deactivate account; opt out of marketing communications.",
    "7. Children’s Privacy: We don’t knowingly collect personal data from users under 16 without parental/guardian consent; age verification applies when under 18.",
    "8. Cookies & Tracking: We use essential cookies and minimal tracking to improve performance and usability.",
    "9. Breach Notification (per NDPA Sections 40 & 29): We will notify the NDPC within 72 hours of becoming aware of a breach likely to risk data subject rights, and inform affected users promptly if it presents high risk",
    "10. Data Retention & Cross-border Transfers :We retain personal data only for as long as needed to provide services or as mandated by law.",
    "11. Transfers of data outside Nigeria occur only with appropriate safeguards (e.g., contractual clauses, NDPC-approved mechanisms) ",
    "12. Changes to Privacy Policy: We may update this policy; major changes will be communicated via the app or email. Continued use indicates acceptance.",
    "13. AI Training Data Usage: We may use anonymized or aggregated platform data (e.g., usage metadata, non‑identifiable content) to train or fine‑tune internal AI models to improve services. Any personal data used for AI purposes will be pseudonymized or anonymized beforehand.",
    "14. Withdrawal of AI Consent: You have the right under NDPA to withdraw consent for your data being used in AI training. Requests to opt out will be processed within 30 days and apply prospectively.",
    "15. No External AI Access: TrybeMarket does not share user data with external parties for AI or ML model training unless you have explicitly agreed to such use in writing.",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Head>
        <title>Sign Up - Trybe Market</title>
        <meta
          name="description"
          content="Create an account on Trybe Market to start buying and selling."
        />
      </Head>
      <Card className="w-full max-w-md shadow-md p-2">
        <CardHeader className="space-y-1 items-center">
          <div className="h-20 w-40 relative mb-2">
            <Image
              src="/assets/logo.png"
              alt="App Logo"
              fill
              className="object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            Create an account
          </CardTitle>
          <CardDescription>
            Sign up to get started with Trybe Market
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Full Name"
                  className="pl-10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  aria-label="Full Name Input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  aria-label="Email Input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  aria-label="Password Input"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={checked}
                onCheckedChange={(checked) => setChecked(checked === true)}
                aria-label="Agree to Terms and Conditions"
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setShowTerms(true)}
                >
                  Terms & Conditions
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => setShowPrivacy(true)}
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
              aria-label="Sign Up Button"
            >
              {loading ? "Signing up..." : "Sign Up"}
            </Button>
          </form>

          <div className="mt-6 flex items-center">
            <Separator className="flex-grow" />
            <span className="mx-4 text-sm text-gray-500">OR</span>
            <Separator className="flex-grow" />
          </div>

          <Button
            variant="outline"
            className="w-full mt-4 flex items-center justify-center gap-2"
            onClick={handleGoogleSignUp}
            disabled={loading || isGoogleSigningIn}
            aria-label="Sign Up with Google"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Sign up with Google
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:underline font-medium"
            >
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Terms & Conditions
            </DialogTitle>
            <DialogDescription>
              Welcome to Trybe Market! By using our platform, you agree to
              comply with these Terms and Conditions. Please read them
              carefully.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {termsParagraphs.map((paragraph, index) => (
              <p key={index} className="text-sm text-gray-700">
                {paragraph}
              </p>
            ))}
            <p className="text-sm text-gray-700 mt-4">
              <strong>Contact Us</strong>
              <br />
              If you have any questions about these Terms, please contact our
              support team.
            </p>
            <p className="text-sm text-gray-500">Last Updated: May 2025</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Privacy Policy
            </DialogTitle>
            <DialogDescription>
              At Trybe Market, we respect your privacy and are committed to
              protecting your personal information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {privacyParagraphs.map((paragraph, index) => (
              <p key={index} className="text-sm text-gray-700">
                {paragraph}
              </p>
            ))}
            <p className="text-sm text-gray-700 mt-4">
              I consent to Market Trybe using my anonymized data (e.g., usage
              stats and metadata) to train internal AI systems to improve app
              features. I understand I can withdraw this consent at any time.
              <br />
              <strong>Contact Us</strong>
              <br />
              If you have any questions regarding this Privacy Policy, please
              contact us.
            </p>
            <p className="text-sm text-gray-500">Last Updated: May 2025</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
