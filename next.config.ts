import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'klthwrzyyrdgaoemrrhl.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'substitutes.us',
      },
    ],
  },
};

export default nextConfig;
