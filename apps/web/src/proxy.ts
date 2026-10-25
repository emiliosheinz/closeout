import { type NextRequest, NextResponse } from "next/server";
import { canonicalCatalogSearch } from "@/features/catalog-filter";
import { requireEnv } from "@/shared/config/env";
import {
  CLIENT_IP_HEADER,
  INTERNAL_SECRET_HEADER,
} from "@/shared/config/internal-headers";

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
 *
 * Also sends a store catalog URL that is not in its clean form to the clean
 * one. The page streams behind a loading state, so a redirect from the page
 * itself would arrive as a 200 with a meta refresh instead of a 307.
 */
export function proxy(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith("/store/")) return catalogRedirect(req);
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

function catalogRedirect(req: NextRequest): NextResponse {
  const search = canonicalCatalogSearch(req.nextUrl.searchParams);
  if (search === null) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // `:slug` is one segment: the catalog, not its item pages.
  matcher: ["/api/v1/:path*", "/media/:path*", "/store/:slug"],
};
