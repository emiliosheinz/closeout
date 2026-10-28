import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";
import {
  BAD_REQUEST,
  ORIGIN_FORBIDDEN,
  PAYLOAD_TOO_LARGE,
  problemDocumentSchema,
} from "@closeout/contracts/schemas";
import { type NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/shared/config/env";
import { isSameOrigin } from "@/shared/lib/origin";

/*
 * Shared by the route handlers that own the session cookie (login, logout,
 * invite accept) and the catalog revalidate handler.
 */

const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** An RFC 9457 problem document response whose `detail` is pt-BR copy. */
export function problem(status: number, detail: string): NextResponse {
  return NextResponse.json(
    {
      type: "about:blank",
      title: STATUS_CODES[status] ?? "Error",
      status,
      detail,
      // ponytail: fresh id per rejection; echo an incoming x-request-id once the web logs requests
      requestId: randomUUID(),
    },
    { status, headers: { "Content-Type": PROBLEM_CONTENT_TYPE } },
  );
}

/**
 * Relays a failed API response to the browser. A problem document passes
 * through with its status, body and `Retry-After`; any other body becomes a
 * problem with the same status and `fallback` as its detail.
 */
export async function relayProblem(
  response: Response,
  fallback: string,
): Promise<NextResponse> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!problemDocumentSchema.safeParse(body).success) {
    return problem(response.status, fallback);
  }
  const headers = new Headers({ "Content-Type": PROBLEM_CONTENT_TYPE });
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) headers.set("Retry-After", retryAfter);
  return NextResponse.json(body, { status: response.status, headers });
}

/** 403 for a request that did not come from the site itself, else null. */
export function refuseCrossOrigin(request: NextRequest): NextResponse | null {
  if (
    isSameOrigin(request.headers.get("origin"), requireEnv("PUBLIC_BASE_URL"))
  )
    return null;
  return problem(403, ORIGIN_FORBIDDEN);
}

/**
 * Reads the body as text, giving up as soon as it exceeds `maxBytes`, so an
 * oversized or chunked upload is never buffered whole.
 */
export async function readCapped(
  request: NextRequest,
  maxBytes: number,
): Promise<string | null> {
  if (Number(request.headers.get("content-length")) > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** The capped body as a JSON object, or the 413/400 response to send instead. */
export async function readJsonObject(
  request: NextRequest,
  maxBytes: number,
): Promise<Record<string, unknown> | NextResponse> {
  const text = await readCapped(request, maxBytes);
  if (text === null) {
    return problem(413, PAYLOAD_TOO_LARGE);
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  if (!parsed || typeof parsed !== "object") {
    return problem(400, BAD_REQUEST);
  }
  return parsed as Record<string, unknown>;
}
