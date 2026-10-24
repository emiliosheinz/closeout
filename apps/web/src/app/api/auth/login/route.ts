import { type NextRequest, NextResponse } from "next/server";
import { readJsonObject, refuseCrossOrigin } from "@/lib/admin/auth-route";
import { apiUrl, internalAuthHeaders } from "@/shared/api/index.server";
import { setSessionCookie } from "@/shared/lib/session-cookie";

const MAX_BODY_BYTES = 4096;

/**
 * Exchanges credentials for a session through the API and sets the session
 * cookie. Only this server-side handler knows the internal secret the API
 * requires for logins, which is also how the visitor's IP reaches the rate
 * limiter.
 */
export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;

  const credentials = await readJsonObject(request, MAX_BODY_BYTES);
  if (credentials instanceof NextResponse) return credentials;

  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: internalAuthHeaders(request.headers.get("x-real-ip")),
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message =
      response.status === 400
        ? "Informe um e-mail válido e a senha."
        : typeof body.message === "string"
          ? body.message
          : "Não foi possível entrar agora.";
    return NextResponse.json({ message }, { status: response.status });
  }

  const { sessionToken, expiresAt } = (await response.json()) as {
    sessionToken: string;
    expiresAt: string;
  };
  const result = NextResponse.json({ ok: true });
  setSessionCookie(result.cookies, sessionToken, new Date(expiresAt));
  return result;
}
