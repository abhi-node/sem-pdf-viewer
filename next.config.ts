import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
