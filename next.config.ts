import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hanya gunakan standalone saat build Docker (Vercel membutuhkan default build output)
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),
};

export default nextConfig;
