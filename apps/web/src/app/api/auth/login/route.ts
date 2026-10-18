import { type NextRequest, NextResponse } from "next/server";
import { clientIpFrom, isSameOrigin } from "@/lib/admin/origin";
import { apiUrl } from "@/lib/admin/server-api";
import { setSessionCookie } from "@/lib/admin/session-cookie";
import { requireEnv } from "@/lib/env";
import {
  CLIENT_IP_HEADER,
  INTERNAL_SECRET_HEADER,
} from "@/lib/internal-headers";

const MAX_BODY_BYTES = 4096;

/**
 * Reads the body as text, giving up as soon as it exceeds `maxBytes`, so an
 * oversized or chunked upload is never buffered whole.
 */
async function readCapped(
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Exchanges credentials for a session through the API and sets the session
 * cookie. Only this server-side handler knows the internal secret the API
 * requires for logins, which is also how the visitor's IP reaches the rate
 * limiter.
 */
export async function POST(request: NextRequest) {
  if (
    !isSameOrigin(request.headers.get("origin"), requireEnv("PUBLIC_BASE_URL"))
  ) {
    return NextResponse.json(
      { message: "Origem não permitida." },
      { status: 403 },
    );
  }

  const text = await readCapped(request, MAX_BODY_BYTES);
  if (text === null) {
    return NextResponse.json(
      { message: "Requisição grande demais." },
      { status: 413 },
    );
  }

  const credentials = parseJson(text) as {
    email?: unknown;
    password?: unknown;
  } | null;
  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json(
      { message: "Requisição inválida." },
      { status: 400 },
    );
  }

  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [INTERNAL_SECRET_HEADER]: requireEnv("INTERNAL_API_SECRET"),
      [CLIENT_IP_HEADER]:
        clientIpFrom(request.headers.get("x-real-ip")) ?? "local",
    },
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
