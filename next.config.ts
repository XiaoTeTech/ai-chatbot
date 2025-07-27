import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: { ppr: true },
  // 忽略 TypeScript 错误
  typescript: {
    ignoreBuildErrors: true,
  },
  // 忽略 ESLint 错误
  eslint: {
    ignoreDuringBuilds: true,
  },
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
