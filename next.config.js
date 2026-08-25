/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        hostname: "cdn.hashnode.com",
        protocol: "https",
      },
    ],
  },
};

module.exports = nextConfig;
