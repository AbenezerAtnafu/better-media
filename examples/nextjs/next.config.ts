import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@better-media/core", "better-media", "@better-media/plugin-validation"],
};

export default nextConfig;
