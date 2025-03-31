import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {    ppr: true,  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
      {
        hostname: 'static.xiaote.com',
      },
      {
        hostname: 'file0.52tesla.com',
      },
    ],
  },
};

export default nextConfig;