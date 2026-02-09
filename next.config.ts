import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
  serverExternalPackages: ["pdf-to-img", "pdfjs-dist"],
};

export default nextConfig;
