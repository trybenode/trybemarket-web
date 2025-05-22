import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "trybemarket",
  description: "student e-commerce platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <body>
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
