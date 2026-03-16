import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  transpilePackages: [
    "better-media",
    "@better-media/core",
    "@better-media/adapter-db",
    "@better-media/adapter-jobs",
    "@better-media/adapter-storage-memory",
    "@better-media/plugin-validation",
    "@better-media/plugin-virus-scan",
  ],
};

export default nextConfig;
