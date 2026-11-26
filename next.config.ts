import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dukascopy-node"],
  turbopack: { root: process.cwd() },
};

export default nextConfig;