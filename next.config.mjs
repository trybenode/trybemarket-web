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
  },
   dev: {
    allowedDevOrigins: ['http://192.168.8.102:3000'],
  },
}

export default nextConfig
