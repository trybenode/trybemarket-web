// app/layout.jsx (server component)
import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import ToastProvider from "@/components/ToastProvider";
import ClientUserLoader from "./ClientUserLoader"
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
          <ClientUserLoader />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
