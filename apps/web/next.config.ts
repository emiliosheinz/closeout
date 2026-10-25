import path from "node:path";
import type { NextConfig } from "next";

// pnpm monorepo: pin Turbopack's workspace root to the repo root so it can
// resolve `next` from any new route file.
const monorepoRoot = path.resolve(__dirname, "..", "..");

const isProd = process.env.NODE_ENV === "production";

// Next injects inline bootstrap scripts, hence 'unsafe-inline'; dev also
// needs eval (React refresh) and ws: (HMR).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isProd ? "" : " ws:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  poweredByHeader: false,
  // No next/image usage; this also disables the /_next/image endpoint.
  images: { unoptimized: true },
  allowedDevOrigins: ["web"],
  // The floating dev badge covers bottom-of-screen controls on phones.
  devIndicators: false,
  turbopack: {
    root: monorepoRoot,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Invite links carry a secret token; never leak it to another site.
      // Later rules win for the same header.
      {
        source: "/invite/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
