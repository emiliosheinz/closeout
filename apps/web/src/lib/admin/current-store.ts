import { redirect } from "next/navigation";
import type { Role } from "@/shared/config/enums";
import { getMe } from "./server-api";
import type { Me, StoreSettings } from "./types";

export interface Member {
  me: Me;
  store: StoreSettings;
  role: Role;
  /** The caller's own contact profile in the store. */
  sellerId: string;
}

/** Owners and admins manage the store and its team; sellers only their own listings. */
export function isManager(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/**
 * The signed-in user as a member of their store. Redirects to the login
 * page without a session, and refuses users without a membership.
 */
export async function requireMember(): Promise<Member> {
  const me = await getMe();
  if (!me) redirect("/admin/entrar");
  const [membership] = me.memberships;
  if (!membership) redirect("/admin/entrar?erro=sem-acesso");
  return {
    me,
    store: membership.store,
    role: membership.role,
    sellerId: membership.sellerId,
  };
}
