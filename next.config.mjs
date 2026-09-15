import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        hostname: "cdn.hashnode.com",
        protocol: "https",
      },
      // CMS media uploaded to UploadThing in production
      { hostname: "utfs.io", protocol: "https" },
      { hostname: "*.ufs.sh", protocol: "https" },
    ],
    // Local cover images for the restored posts are SVGs (public/covers/)
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default withPayload(nextConfig);
