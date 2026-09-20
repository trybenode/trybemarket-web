import { SITE_URL } from "@/lib/siteUrl";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Private auth-required pages
          "/api/",
          "/settings",
          "/edit-profile",
          "/kyc",
          "/messages",
          "/favorites",
          "/chat/",
          "/data-deletion",
          "/my-shop",
          // Upload flows (redirect unauthenticated users)
          "/upload",
          "/product-upload",
          "/service-upload",
          "/select-boost-item",
          "/subscription",
          // Transactional redirect pages
          "/thank-you",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
