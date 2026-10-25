import type { Me, Member } from "./types";

/** The member's first store membership, or null for an account with none. */
export function toMember(me: Me): Member | null {
  const [membership] = me.memberships;
  if (!membership) return null;
  return {
    me,
    store: membership.store,
    role: membership.role,
    sellerId: membership.sellerId,
  };
}
