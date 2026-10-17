import { type NextRequest, NextResponse } from "next/server";
import { clientIpFrom, isSameOrigin } from "@/lib/admin/origin";
import { apiUrl, INTERNAL_SECRET_HEADER } from "@/lib/admin/server-api";
import { setSessionCookie } from "@/lib/admin/session-cookie";
import { requireEnv } from "@/lib/env";

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

  const credentials = (await request.json().catch(() => null)) as {
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
      "x-client-ip":
        clientIpFrom(request.headers.get("x-forwarded-for")) ?? "local",
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
