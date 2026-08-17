import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@openai/agents"],
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
