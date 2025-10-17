/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002',
  },
  // Disable image optimization for static export if needed
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;

