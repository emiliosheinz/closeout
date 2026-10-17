import { createHash, timingSafeEqual } from "node:crypto";

/** Header carrying the shared secret on web → api server-side calls. */
export const INTERNAL_SECRET_HEADER = "x-internal-secret";

/** Header carrying the visitor's IP, trusted only on internal requests. */
export const CLIENT_IP_HEADER = "x-client-ip";

type Headers = Record<string, string | string[] | undefined>;

/**
 * True when the request carries `INTERNAL_API_SECRET`. Only apps/web knows
 * the secret, and the API port is not published outside the Docker network.
 */
export function isInternalRequest(headers: Headers): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    throw new Error("INTERNAL_API_SECRET must be set");
  }
  const provided = headers[INTERNAL_SECRET_HEADER];
  if (typeof provided !== "string") return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

/** The visitor IP forwarded by apps/web, or null when absent or untrusted. */
export function trustedClientIp(headers: Headers): string | null {
  const ip = headers[CLIENT_IP_HEADER];
  if (isInternalRequest(headers) && typeof ip === "string" && ip) return ip;
  return null;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
