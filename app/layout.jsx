import "./globals.css";
import { Toaster } from "react-hot-toast";
import { ToastProvider } from "@/components/ToastProvider";
export const metadata = {
  title: "trybemarket",
  description: "student e-commerce platform",
  icons:{
    // icon: "/logo.png"
    icon: '/logo.jpeg'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>
        {/* <ToastProvider /> //use to fix hydration          */}
        <Toaster
          position='top-center'
          toastOptions={{
            success: {
              style: {
                background: "#FFFFFF",
                color: "#808080",
              },
            },
            error: {
              style: {
                background: "#FFFFFF",
                color: "#808080",
              },
            },
            duration: 2000,
          }}
        />
        {children}
      </body>
    </html>
  );
}
