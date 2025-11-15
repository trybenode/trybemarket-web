import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import ToastProvider from "@/components/ToastProvider";
import { SpeedInsights } from "@vercel/speed-insights/next"
export const metadata = {
  title: {
  default: "TrybeMarket | Campus Marketplace for Students & Artisans",
  template: "TrybeMarket | %s",
  absolute: "TrybeMarket | Buy, Sell & Hire Services on Campus",
},
description:
  "TrybeMarket is the smart campus marketplace that lets students buy, sell, and hire services effortlessly. Create your shop link, list products, showcase your skills, and reach more buyers without spamming group chats. Built for student entrepreneurs, vendors, and campus artisans.",
keywords: [
  "TrybeMarket",
  "TrybeNode",
  "student marketplace Nigeria",
  "campus e-commerce",
  "sell on campus",
  "hire student artisans",
  "student service providers",
  "campus business app",
  "campus marketplace Africa",
  "student hustlers platform",
  "shop link generator",
  "sell online Nigeria students",
  "student freelance platform",
],

openGraph: {
  title: "TrybeMarket | Campus Marketplace for Students & Artisans",
  description:
    "Create your shop link, list products, and reach more buyers without spamming groups. TrybeMarket helps students sell smarter, showcase services, and grow their brand on campus.",
  url: "https://trybemarket.online",
  siteName: "TrybeMarket",
  // images: [
  //   {
  //     url: "https://trybemarket.onlineopengraph-image.png",
  //     width: 1200,
  //     height: 630,
  //     alt: "TrybeMarket - Campus Marketplace for Students",
  //   },
  // ],
  locale: "en_US",
  type: "website",
},

twitter: {
  card: "summary_large_image",
  title: "TrybeMarket | Buy, Sell & Hire Services on Campus",
  description:
    "TrybeMarket empowers students to sell products, showcase their services, and grow without stress. One link. Zero spam. Full campus reach.",
  images: ["https://trybemarket.com/opengraph-image.png"],
  creator: "@TrybeMarket",
},

metadataBase: new URL("https://trybemarket.online"),

robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
},

verification: {
  // Google, Meta, Pinterest, or others
},

  icons: { icon: "/trybemarket.png" },
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
