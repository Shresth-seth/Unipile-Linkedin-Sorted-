import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/account",
        destination: "/register",
        permanent: false, // Set to true if you want browsers to cache this redirect forever
      },
    ];
  },
};

export default nextConfig;
