import type { AssignableRole } from "@/shared/config/enums";
import { apiUrl, internalAuthHeaders } from "./server-api";

export interface InviteDetails {
  storeName: string;
  email: string;
  role: AssignableRole;
}

export type InviteLookup =
  | { state: "valid"; invite: InviteDetails }
  | { state: "invalid" }
  | { state: "too-many" };

/**
 * Resolves an invite token on the API. Every invalid reason (unknown,
 * expired, revoked, replaced, used, malformed) comes back as one state so
 * the page cannot tell them apart.
 */
export async function lookupInvite(
  token: string,
  realIpHeader: string | null,
): Promise<InviteLookup> {
  const response = await fetch(apiUrl("/auth/invites/lookup"), {
    method: "POST",
    headers: internalAuthHeaders(realIpHeader),
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  if (response.ok) {
    return { state: "valid", invite: (await response.json()) as InviteDetails };
  }
  if (response.status === 429) return { state: "too-many" };
  if (response.status === 400 || response.status === 404) {
    return { state: "invalid" };
  }
  throw new Error(`Invite lookup failed with ${response.status}`);
}
