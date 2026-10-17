import { type NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

/**
 * Forwards browser requests to the API, which is reachable only inside the
 * Docker network:
 * - `/api/v1/*` → API with the prefix stripped (admin calls)
 * - `/media/*`  → API `/media/*` (images, same-origin and cacheable)
 * Reads `API_BASE_URL` per request so one built image works everywhere.
 */
export function proxy(req: NextRequest): NextResponse {
  const apiBaseUrl = requireEnv("API_BASE_URL").replace(/\/$/, "");
  const upstreamPath = req.nextUrl.pathname.replace(/^\/api\/v1/, "");
  return NextResponse.rewrite(
    new URL(`${upstreamPath}${req.nextUrl.search}`, `${apiBaseUrl}/`),
  );
}

export const config = {
  matcher: ["/api/v1/:path*", "/media/:path*"],
};
