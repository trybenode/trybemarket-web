import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import ToastProvider from "@/components/ToastProvider";
import { SpeedInsights } from "@vercel/speed-insights/next"
export const metadata = {
  title: "trybemarket",
  description: "student e-commerce platform",
  icons: { icon: "/logo.jpeg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>
        <ToastProvider />
        <UserProvider>
          {children}
        </UserProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
