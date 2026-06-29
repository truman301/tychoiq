/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The scan worker uses Node built-ins; keep them external in server bundles.
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: {
    // MVP: do not fail production builds on lint. Run `npm run lint` separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
