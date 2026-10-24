import { cookies } from "next/headers";
import { cache } from "react";
import { requireEnv } from "../env";
import { CLIENT_IP_HEADER, INTERNAL_SECRET_HEADER } from "../internal-headers";
import { clientIpFrom } from "./origin";
import { SESSION_COOKIE_NAME } from "./session-cookie";
import type { Me } from "./types";

export { INTERNAL_SECRET_HEADER };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function apiUrl(path: string): string {
  return `${requireEnv("API_BASE_URL").replace(/\/$/, "")}${path}`;
}

/**
 * Server-side admin request carrying the visitor's session cookie. Returns
 * null on 400/401/404 so pages can redirect or render not-found.
 */
export async function adminGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const response = await fetch(apiUrl(path), {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });
  // 400 here means a malformed id in the URL: as absent as an unknown one.
  if ([400, 401, 404].includes(response.status)) return null;
  if (!response.ok) {
    throw new Error(`Admin request ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

/** The signed-in admin; deduplicated across layout and page in one request. */
export const getMe = cache((): Promise<Me | null> => adminGet<Me>("/me"));

/**
 * Headers the API requires on its internal auth endpoints: the shared secret
 * and the visitor's IP for the per-client rate limits. Without a trusted IP
 * every such visitor shares one bucket, so that is logged.
 */
export function internalAuthHeaders(
  realIpHeader: string | null,
): Record<string, string> {
  const ip = clientIpFrom(realIpHeader);
  if (!ip) {
    console.warn("No X-Real-IP on an auth request; using the shared bucket");
  }
  return {
    "Content-Type": "application/json",
    [INTERNAL_SECRET_HEADER]: requireEnv("INTERNAL_API_SECRET"),
    [CLIENT_IP_HEADER]: ip ?? "local",
  };
}
