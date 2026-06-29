import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@txline-predict/txline-client"],
  // Monorepo: trace files from workspace root so dev chunks resolve consistently.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/logo.svg",
        permanent: false,
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid stale chunk references after HMR (common on Windows).
      config.cache = false;
      if (process.platform === "win32") {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 600,
          ignored: ["**/.git/**", "**/node_modules/**"],
        };
      }
    }
    return config;
  },
};

export default nextConfig;
