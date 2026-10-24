import "server-only";

import { requireEnv } from "@/shared/config/env";
import {
  CLIENT_IP_HEADER,
  INTERNAL_SECRET_HEADER,
} from "@/shared/config/internal-headers";
import { clientIpFrom } from "@/shared/lib/origin";

export { adminGet } from "./server/admin-get";
export { apiUrl } from "./server/api-url";
export { INTERNAL_SECRET_HEADER };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

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
