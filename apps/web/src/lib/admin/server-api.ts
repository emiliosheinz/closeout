import { cookies } from "next/headers";
import { requireEnv } from "../env";
import { SESSION_COOKIE_NAME } from "./session-cookie";
import type { Me } from "./types";

/** Header carrying the shared secret on server-to-server calls. */
export const INTERNAL_SECRET_HEADER = "x-internal-secret";

export function apiUrl(path: string): string {
  return `${requireEnv("API_BASE_URL").replace(/\/$/, "")}${path}`;
}

/**
 * Server-side admin request carrying the visitor's session cookie. Returns
 * null on 401/404 so pages can redirect or render not-found.
 */
export async function adminGet<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const response = await fetch(apiUrl(path), {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Admin request ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getMe(): Promise<Me | null> {
  return adminGet<Me>("/me");
}
