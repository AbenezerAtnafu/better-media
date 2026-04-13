import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  transpilePackages: [
    "@better-media/framework",
    "@better-media/core",
    "@better-media/adapter-db-memory",
    "@better-media/adapter-jobs",
    "@better-media/adapter-storage-memory",
    "@better-media/plugin-validation",
    "@better-media/plugin-virus-scan",
    "@better-media/plugin-media-processing",
  ],
};

export default nextConfig;
