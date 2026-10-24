import { type NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/shared/config/env";
import { isSameOrigin } from "@/shared/lib/origin";

/*
 * Shared by the route handlers that own the session cookie (login, logout,
 * invite accept).
 */

/** 403 for a request that did not come from the site itself, else null. */
export function refuseCrossOrigin(request: NextRequest): NextResponse | null {
  if (
    isSameOrigin(request.headers.get("origin"), requireEnv("PUBLIC_BASE_URL"))
  )
    return null;
  return NextResponse.json(
    { message: "Origem não permitida." },
    { status: 403 },
  );
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
    return NextResponse.json(
      { message: "Requisição grande demais." },
      { status: 413 },
    );
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json(
      { message: "Requisição inválida." },
      { status: 400 },
    );
  }
  return parsed as Record<string, unknown>;
}
