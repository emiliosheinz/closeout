import "server-only";

import { cookies } from "next/headers";
import type { Schema } from "@/shared/api/http/schema";
import { SESSION_COOKIE_NAME } from "@/shared/lib/session-cookie";
import { apiUrl } from "./api-url";

/**
 * Server-side admin request carrying the visitor's session cookie. Returns
 * null on 400/401/404 so pages can redirect or render not-found; a body that
 * fails the schema is logged and thrown for the route's error boundary.
 */
export async function adminGet<T>(
  path: string,
  schema: Schema<T>,
): Promise<T | null> {
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
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    console.error(`Response from ${path} failed its schema`, result.error);
    throw new Error(`Admin response ${path} failed its schema`);
  }
  return result.data;
}
