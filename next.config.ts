import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "@netlify/blobs", "firebase-admin"],
};

export default nextConfig;
