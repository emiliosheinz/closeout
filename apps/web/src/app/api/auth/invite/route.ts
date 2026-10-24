import { type NextRequest, NextResponse } from "next/server";
import { readJsonObject, refuseCrossOrigin } from "@/lib/admin/auth-route";
import { apiUrl, internalAuthHeaders } from "@/lib/admin/server-api";
import { setSessionCookie } from "@/lib/admin/session-cookie";

const MAX_BODY_BYTES = 4096;

/**
 * Accepts an invite through the API, which creates the account, and signs
 * the new member in by setting the session cookie. The API's pt-BR messages
 * (invalid link, field errors, rate limit) pass through unchanged.
 */
export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;

  const input = await readJsonObject(request, MAX_BODY_BYTES);
  if (input instanceof NextResponse) return input;

  const response = await fetch(apiUrl("/auth/invites/accept"), {
    method: "POST",
    headers: internalAuthHeaders(request.headers.get("x-real-ip")),
    body: JSON.stringify({
      token: input.token,
      name: input.name,
      password: input.password,
      whatsappNumber: input.whatsappNumber,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: unknown;
    };
    const message =
      typeof body.message === "string" || Array.isArray(body.message)
        ? body.message
        : "Não foi possível aceitar o convite agora.";
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
