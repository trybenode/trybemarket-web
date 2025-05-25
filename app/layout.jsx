import "./globals.css";
import { Toaster } from "react-hot-toast";
import { UserProvider } from "@/context/UserContext";
import ToastProvider from "@/components/ToastProvider";
export const metadata = {
  title: "trybemarket",
  description: "student e-commerce platform",
  icons: {
    // icon: "/logo.png"
    icon: "/logo.jpeg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>
        <ToastProvider />
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
