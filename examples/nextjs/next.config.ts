import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@better-media/core", "@better-media/sdk", "@better-media/plugin-validation"],
};

export default nextConfig;
