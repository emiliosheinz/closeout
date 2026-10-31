import { redirect } from "next/navigation";
import { cache } from "react";
import { loadRead } from "@/shared/api/index.server";
import { NO_ACCESS_ERROR } from "../model/session-expired";
import { toMember } from "../model/to-member";
import type { Me, Member } from "../model/types";
import { sessionReads } from "./reads";

/**
 * The signed-in admin; deduplicated across layout and page in one request,
 * and left in the request's query cache for the panel to hydrate.
 */
export const getMe = cache(
  (): Promise<Me | null> => loadRead(sessionReads.me()),
);

/**
 * The signed-in user as a member of their store. Redirects to the login
 * page without a session, and refuses users without a membership.
 */
export async function requireMember(): Promise<Member> {
  const me = await getMe();
  if (!me) redirect("/admin/login");
  const member = toMember(me);
  if (!member) redirect(`/admin/login?error=${NO_ACCESS_ERROR}`);
  return member;
}
