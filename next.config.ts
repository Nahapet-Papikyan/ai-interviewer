import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openai/agents"],
};

export default nextConfig;
