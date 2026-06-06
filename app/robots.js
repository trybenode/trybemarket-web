export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/settings",
          "/edit-profile",
          "/kyc",
          "/messages",
          "/favorites",
          "/chat",
          "/data-deletion",
        ],
      },
    ],
    sitemap: "https://trybemarket.online/sitemap.xml",
  };
}
