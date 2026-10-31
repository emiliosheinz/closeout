import { BAD_REQUEST } from "@closeout/contracts/schemas";
import { type NextRequest, NextResponse } from "next/server";
import {
  problem,
  readJsonObject,
  refuseCrossOrigin,
  relayProblem,
} from "@/_app/api-routes/auth-route";
import { apiUrl, internalAuthHeaders } from "@/shared/api/index.server";

const MAX_BODY_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 10_000;
const SIGNUP_FAILED = "Não foi possível entrar na lista agora.";
const FIELDS = ["name", "channel", "contact", "ref", "src", "website"];

/**
 * Relays a waitlist signup to the API. Only the signup fields the browser
 * sent are forwarded; the API's answer (204 or a problem document) passes
 * through, and an unreachable or hanging API becomes a 502.
 */
export async function POST(request: NextRequest) {
  const refused = refuseCrossOrigin(request);
  if (refused) return refused;

  const input = await readJsonObject(request, MAX_BODY_BYTES);
  if (input instanceof NextResponse) return input;
  if (Array.isArray(input)) return problem(400, BAD_REQUEST);

  const body = Object.fromEntries(
    FIELDS.filter((field) => field in input).map((field) => [
      field,
      input[field],
    ]),
  );

  let response: Response;
  try {
    response = await fetch(apiUrl("/waitlist/signups"), {
      method: "POST",
      headers: internalAuthHeaders(request.headers.get("x-real-ip")),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(
      "Waitlist signup request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return problem(502, SIGNUP_FAILED);
  }

  if (response.status === 204) return new NextResponse(null, { status: 204 });
  return relayProblem(response, SIGNUP_FAILED);
}
