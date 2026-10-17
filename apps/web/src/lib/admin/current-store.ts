import { redirect } from "next/navigation";
import { storeSlug } from "../site";
import { getMe } from "./server-api";
import type { Me, StoreSettings } from "./types";

/**
 * The signed-in admin and the store this deployment serves. Redirects to the
 * login page without a session, and refuses admins of other stores.
 */
export async function requireAdmin(): Promise<{
  me: Me;
  store: StoreSettings;
}> {
  const me = await getMe();
  if (!me) redirect("/admin/entrar");
  const membership = me.memberships.find((m) => m.store.slug === storeSlug());
  if (!membership) redirect("/admin/entrar?erro=sem-acesso");
  return { me, store: membership.store };
}
