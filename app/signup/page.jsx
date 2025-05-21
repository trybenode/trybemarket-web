"use client"


import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [checked, setChecked] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const handleSignUp = async (e) => {
    e.preventDefault()

    // Basic validation
    if (!email || !fullName || !password) {
      toast({
        title: "Incomplete Fields",
        description: "Please fill in all fields to continue.",
        variant: "destructive",
      })
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
      return
    }

    if (!checked) {
      toast({
        title: "Terms & Conditions",
        description: "Please agree to the Terms & Conditions to continue.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)

      // Firebase Sign Up
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Send verification email
      await sendEmailVerification(user)

      // Store user data in Firestore
      const userRef = doc(db, "users", user.uid)
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        fullName,
        isVerified: false,
        emailVerified: false,
        createdAt: new Date().toISOString(),
      })

      toast({
        title: "Account Created",
        description: "A verification email has been sent. Please verify your email.",
      })

      // Log user out after sign-up to force email verification
      setTimeout(async () => {
        await auth.signOut()
        router.push("/login")
      }, 2000)
    } catch (err) {
      console.error("Sign up error:", err.message)

      // Handle Firebase error messages
      if (err.code === "auth/email-already-in-use") {
        toast({
          title: "Email Already Used",
          description: "This email is already registered. Please login or use another email.",
          variant: "destructive",
        })
      } else if (err.code === "auth/invalid-email") {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        })
      } else if (err.code === "auth/weak-password") {
        toast({
          title: "Weak Password",
          description: "Password should be at least 6 characters.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Sign Up Failed",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    // This is a placeholder for Google sign up
    // In a real implementation, you would use Firebase's Google authentication
    toast({
      title: "Google Sign Up",
      description: "Google sign up is not implemented in this demo",
    })
  }

  // Sample terms and privacy content
  const termsParagraphs = [
    "1. Eligibility: You must be a student or a verified user aged 16+. Providing false information or fraudulent activity will lead to suspension.",
    "2. Your Account: Keep your account credentials safe. You are responsible for all activities under your account.",
    "3. Using trybe market: Post only genuine products or services. Respect other users. No scams, fake listings, hate speech, or illegal activities. Posting prohibited items can lead to suspension.",
    "4. Buying & Selling: trybe market connects buyers and sellers but does not guarantee any transaction. Always verify and confirm before paying or delivering. Prefer keeping transactions and chats within the app for safety.",
    "5. Payments & Subscriptions: Some premium features require a subscription. All payments are processed securely via Nigerian payment providers (e.g., Paystack, Flutterwave). No card details are stored by us. Refunds are only issued if a failure is caused directly by trybe market.",
  ]

  const privacyParagraphs = [
    "1. Information We Collect: Personal Info: Name, email, phone number, school, department, profile photo. Account Info: Login data, authentication info (via Firebase). Listings: Products/services uploaded, images (via Cloudinary). Device Info: IP address, device type, OS, for analytics and fraud prevention. Payment Info: Processed securely via third-party gateways (we do not store card details).",
    "2. How We Use Your Information: To create and manage your account. To enable buying and selling interactions. For identity verification (KYC) and building trust. To send updates, promotions, and important communications. To detect fraud and enhance platform security.",
    "3. Data Sharing: We do not sell your personal information. We only share: With payment processors (e.g., Paystack, Flutterwave, Opay). With service providers (e.g., Firebase, Cloudinary). With law enforcement if required by law.",
    "4. Your Rights: As a Nigerian user, you have the right to: Access, correct, or delete your personal information. Deactivate your account. Opt out of marketing communications at any time.",
    "5. Data Security: We use secure systems (like Firebase security standards) to protect your data. No platform is 100% immune; users should also protect their accounts with strong passwords.",
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 items-center">
          <div className="w-40 h-20 relative mb-4">
            <Image src="/placeholder.svg?height=80&width=160" alt="Logo" fill className="object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>Sign up to get started with Trybe Market</CardDescription>
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
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="terms" checked={checked} onCheckedChange={(checked) => setChecked(checked === true)} />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{" "}
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowTerms(true)}>
                  Terms & Conditions
                </button>{" "}
                and{" "}
                <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowPrivacy(true)}>
                  Privacy Policy
                </button>
              </label>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
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
            disabled={loading}
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
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Terms & Conditions</DialogTitle>
            <DialogDescription>
              Welcome to Trybe Market! By using our platform, you agree to comply with these Terms and Conditions.
              Please read them carefully.
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
              If you have any questions about these Terms, please contact our support team.
            </p>
            <p className="text-sm text-gray-500">Last Updated: May 2023</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Privacy Policy</DialogTitle>
            <DialogDescription>
              At Trybe Market, we respect your privacy and are committed to protecting your personal information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {privacyParagraphs.map((paragraph, index) => (
              <p key={index} className="text-sm text-gray-700">
                {paragraph}
              </p>
            ))}
            <p className="text-sm text-gray-700 mt-4">
              <strong>Contact Us</strong>
              <br />
              If you have any questions regarding this Privacy Policy, please contact us.
            </p>
            <p className="text-sm text-gray-500">Last Updated: May 2023</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
