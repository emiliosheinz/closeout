import "server-only";

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/shared/lib/session-cookie";
import type { Schema } from "../http/schema";
import { apiUrl } from "./api-url";

export type AdminOutcome<T> = { data: T } | { status: 400 | 401 | 404 };

/**
 * Server-side admin request carrying the visitor's session cookie. A missing
 * resource or session comes back as `status`; a body that
 * fails the schema is logged and thrown for the route's error boundary.
 */
export async function adminFetch<T>(
  path: string,
  schema: Schema<T>,
): Promise<AdminOutcome<T>> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { status: 401 };
  const response = await fetch(apiUrl(path), {
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
    cache: "no-store",
  });
  // 400 here means a malformed id in the URL: as absent as an unknown one.
  if (
    response.status === 400 ||
    response.status === 401 ||
    response.status === 404
  ) {
    return { status: response.status };
  }
  if (!response.ok) {
    throw new Error(`Admin request ${path} failed with ${response.status}`);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    console.error(`Response from ${path} failed its schema`, result.error);
    throw new Error(`Admin response ${path} failed its schema`);
  }
  return { data: result.data };
}

/** `adminFetch` for callers that treat every missing case the same: null. */
export async function adminGet<T>(
  path: string,
  schema: Schema<T>,
): Promise<T | null> {
  const outcome = await adminFetch(path, schema);
  return "data" in outcome ? outcome.data : null;
}
