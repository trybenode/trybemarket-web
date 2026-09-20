/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    loader: "custom",
    loaderFile: "./lib/cloudinaryLoader.js",
    domains: ["res.cloudinary.com"],

  },

  async headers() {
    return [
      {
        // The worker must never be served stale from an HTTP cache, or a bad
        // release couldn't be replaced. It also needs root scope.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ]
  },
}

export default nextConfig
