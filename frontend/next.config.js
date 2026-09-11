/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    formats: ["image/webp"],
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // Proxy /api/* and /health → Express backend at runtime
  // NEXT_PUBLIC_API_URL must be set in Vercel env vars for production
  // Defaults to http://localhost:4000 for local dev
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return [
      {
        source:      "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source:      "/health",
        destination: `${backend}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
