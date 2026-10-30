import { sessionResponseSchema } from "@closeout/contracts/schemas";
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
const ACCEPT_FAILED = "Não foi possível aceitar o convite agora.";

/**
 * Accepts an invite through the API, which creates the account, and signs
 * the new member in by setting the session cookie. The API's problem
 * documents (invalid link, field errors, rate limit) pass through unchanged.
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

  if (!response.ok) return relayProblem(response, ACCEPT_FAILED);

  const session = sessionResponseSchema.safeParse(await response.json());
  if (!session.success) {
    console.error("Session response failed its schema", session.error);
    return problem(502, ACCEPT_FAILED);
  }
  const { sessionToken, expiresAt } = session.data;
  const result = NextResponse.json({ ok: true });
  setSessionCookie(result.cookies, sessionToken, new Date(expiresAt));
  return result;
}
