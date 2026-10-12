import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A single upstream feed timing out should never fail the build.
  staticPageGenerationTimeout: 180,
};

export default nextConfig;
