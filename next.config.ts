import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "@netlify/blobs"],
};

export default nextConfig;
