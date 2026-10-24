import { type NextRequest, NextResponse } from "next/server";
import { refuseCrossOrigin } from "@/lib/admin/auth-route";
import { apiUrl, INTERNAL_SECRET_HEADER } from "@/shared/api/index.server";
import { requireEnv } from "@/shared/config/env";
import {
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/shared/lib/session-cookie";

/**
 * Revokes the session on the API, drops the cookie and sends the browser to
 * the login page. A plain form POST, so signing out works before scripts load.
 */
export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const response = await fetch(apiUrl("/auth/logout"), {
      method: "POST",
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        [INTERNAL_SECRET_HEADER]: requireEnv("INTERNAL_API_SECRET"),
      },
      cache: "no-store",
    });
    if (!response.ok && response.status !== 401) {
      console.error(`Logout failed upstream with ${response.status}`);
    }
  }
  const result = NextResponse.redirect(
    new URL("/admin/entrar", requireEnv("PUBLIC_BASE_URL")),
    303,
  );
  clearSessionCookie(result.cookies);
  return result;
}
