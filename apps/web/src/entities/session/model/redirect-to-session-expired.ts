import { redirect } from "next/navigation";
import { SESSION_EXPIRED_HREF } from "./session-expired";

/** Sends the member to the login page with the session-expired notice. */
export function redirectToSessionExpired(): never {
  redirect(SESSION_EXPIRED_HREF);
}
