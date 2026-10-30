import {
  LOGIN_FAILED,
  LOGIN_INVALID,
  sessionResponseSchema,
} from "@closeout/contracts/schemas";
import { type NextRequest, NextResponse } from "next/server";
import {
  problem,
  readJsonObject,
  refuseCrossOrigin,
  relayProblem,
} from "@/_app/api-routes/auth-route";
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

  if (response.status === 400) return problem(400, LOGIN_INVALID);
  if (!response.ok) return relayProblem(response, LOGIN_FAILED);

  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) {
    console.error("Session response failed its schema", session.error);
    return problem(502, LOGIN_FAILED);
  }
  const { sessionToken, expiresAt } = session.data;
  const result = NextResponse.json({ ok: true });
  setSessionCookie(result.cookies, sessionToken, new Date(expiresAt));
  return result;
}
