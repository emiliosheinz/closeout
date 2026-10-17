import { parse as parseCookieHeader } from "cookie";

/** Name of the opaque session cookie. apps/web sets it after login. */
export const SESSION_COOKIE_NAME = "closeout_session";

/** Lifetime of a session, in milliseconds. */
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function readSessionCookie(
  cookieHeader: string | string[] | undefined,
): string | null {
  if (!cookieHeader) return null;
  const header = Array.isArray(cookieHeader)
    ? cookieHeader.join("; ")
    : cookieHeader;
  const value = parseCookieHeader(header)[SESSION_COOKIE_NAME];
  return value && value.length > 0 ? value : null;
}
