import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, which a .fit file from a long ride/run can exceed
      // (uploadFitFile in lib/actions/devices.ts rejects anything over
      // 20MB itself — this just needs enough headroom to let that check run
      // instead of the request being rejected earlier, at the transport level).
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
