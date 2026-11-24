import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build plain HTML/JS/CSS into out/. There is no server: all data stays on the phone.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
