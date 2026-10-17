/** Mirrors the API's cookie name; the web owns setting and clearing it. */
export const SESSION_COOKIE_NAME = "closeout_session";

export interface CookieJar {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      expires?: Date;
      maxAge?: number;
    },
  ): unknown;
}

/**
 * HttpOnly so scripts cannot read it, SameSite=Lax so other sites cannot
 * send it on form posts, Secure in production, host-only, Path=/.
 */
export function setSessionCookie(
  cookies: CookieJar,
  token: string,
  expiresAt: Date,
): void {
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(cookies: CookieJar): void {
  cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
