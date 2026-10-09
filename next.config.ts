import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "@netlify/blobs", "firebase-admin", "stripe"],
};

export default nextConfig;
