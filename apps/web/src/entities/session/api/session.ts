import { meSchema } from "@closeout/contracts/schemas";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminGet } from "@/shared/api/index.server";
import type { Me, Member } from "../model/types";

/** The signed-in admin; deduplicated across layout and page in one request. */
export const getMe = cache((): Promise<Me | null> => adminGet("/me", meSchema));

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
