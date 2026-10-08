import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      { source: "/signin.html", destination: "/login" },
      { source: "/signin", destination: "/login" },
    ];
  },
};

export default nextConfig;
