import {
  type InviteDetails,
  inviteDetailsSchema,
} from "@closeout/contracts/schemas";
import { apiUrl, internalAuthHeaders } from "@/shared/api/index.server";

export type { InviteDetails };

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
    const result = inviteDetailsSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("Invite lookup response failed its schema", result.error);
      throw new Error("Invite lookup response failed its schema");
    }
    return { state: "valid", invite: result.data };
  }
  if (response.status === 429) return { state: "too-many" };
  if (response.status === 400 || response.status === 404) {
    return { state: "invalid" };
  }
  throw new Error(`Invite lookup failed with ${response.status}`);
}
