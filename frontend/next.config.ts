import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/login", destination: "/opening", permanent: false },
      { source: "/signin", destination: "/opening", permanent: false },
      { source: "/signin.html", destination: "/opening", permanent: false },
      { source: "/logout", destination: "/opening", permanent: false },
    ];
  },
};

export default nextConfig;
