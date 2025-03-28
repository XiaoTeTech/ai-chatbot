import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {    ppr: true,  },
  // output: 'standalone',
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'static.xiaote.com',
      },
    ],
  },
};

export default nextConfig;