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
  
}

export default nextConfig
