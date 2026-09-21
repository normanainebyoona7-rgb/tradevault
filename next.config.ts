import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["dukascopy-node"],
  // ... your other existing config options stay here
};

export default nextConfig;