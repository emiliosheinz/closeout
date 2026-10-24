import { type NextRequest, NextResponse } from "next/server";
import {
  CLIENT_IP_HEADER,
  INTERNAL_SECRET_HEADER,
} from "@/lib/internal-headers";
import { requireEnv } from "@/shared/config/env";

/** Headers only trusted server-to-server; a browser must never supply them. */
const STRIPPED_HEADERS = [INTERNAL_SECRET_HEADER, CLIENT_IP_HEADER];

/**
 * Builds the upstream URL by concatenation so the host is always the API's,
 * even for paths like `//evil.example/x` that `new URL` would treat as a host.
 */
function upstreamUrl(
  apiBaseUrl: string,
  pathname: string,
  search: string,
): URL {
  const base = apiBaseUrl.replace(/\/$/, "");
  const upstreamPath = pathname.replace(/^\/api\/v1/, "");
  const url = new URL(`${base}${upstreamPath}${search}`);
  if (url.origin !== new URL(base).origin) {
    throw new Error("Upstream origin mismatch");
  }
  return url;
}

/**
 * Forwards browser requests to the API, which is reachable only inside the
 * Docker network:
 * - `/api/v1/*` → API with the prefix stripped (admin calls)
 * - `/media/*`  → API `/media/*` (images, same-origin and cacheable)
 * Reads `API_BASE_URL` per request so one built image works everywhere.
 */
export function proxy(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  for (const name of STRIPPED_HEADERS) headers.delete(name);
  return NextResponse.rewrite(
    upstreamUrl(
      requireEnv("API_BASE_URL"),
      req.nextUrl.pathname,
      req.nextUrl.search,
    ),
    { request: { headers } },
  );
}

export const config = {
  matcher: ["/api/v1/:path*", "/media/:path*"],
};
