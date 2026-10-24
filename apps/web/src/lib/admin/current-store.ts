import { redirect } from "next/navigation";
import { getMe } from "./server-api";
import type { Me, StoreSettings } from "./types";

/**
 * The signed-in admin and the store they belong to. Redirects to the login
 * page without a session, and refuses users without a membership.
 */
export async function requireAdmin(): Promise<{
  me: Me;
  store: StoreSettings;
}> {
  const me = await getMe();
  if (!me) redirect("/admin/entrar");
  const [membership] = me.memberships;
  if (!membership) redirect("/admin/entrar?erro=sem-acesso");
  return { me, store: membership.store };
}
