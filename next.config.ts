import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Never let a browser reuse cached HTML: a stale document can reference an
        // old JS bundle and reintroduce fixed session bugs after a redeploy.
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
        missing: [{ type: "header", key: "next-router-prefetch" }],
      },
    ];
  },
};

export default nextConfig;
