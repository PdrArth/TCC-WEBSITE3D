import type { NextConfig } from "next";
import { backendUrl } from "./lib/deployment-backend.mjs";

const nextConfig: NextConfig = {
  experimental: { cpus: 2 },
  async rewrites() {
    return [{
      source: "/experience/audio/genshin-official-theme.mp3",
      destination: backendUrl("/experience/audio/genshin-official-theme.mp3").href,
    }];
  },
  async redirects() {
    return ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].map(source => ({
      source,
      destination: backendUrl(source).href,
      permanent: false,
    }));
  },
};

export default nextConfig;
