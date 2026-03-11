import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fluent-ffmpeg"],
  transpilePackages: [
    "better-media",
    "@better-media/core",
    "@better-media/adapter-db",
    "@better-media/adapter-jobs",
    "@better-media/adapter-storage",
    "@better-media/plugin-validation",
    "@better-media/plugin-virus-scan",
    "@better-media/plugin-media-processing",
  ],
};

export default nextConfig;
