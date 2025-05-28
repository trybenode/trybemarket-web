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
    allowedDevOrigins: ['http://192.168.8.101:3000'], // adjust port as needed
  },
}

export default nextConfig
