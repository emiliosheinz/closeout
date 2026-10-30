/** @vitest-environment node */

import { NextRequest } from "next/server";
import type { MockInstance } from "vitest";
import { POST } from "@/_app/api-routes/invite";
import oracle from "@/test/copy-oracle.json";
import { expectProblem, problem, problemResponse } from "@/test/fixtures";

function accept(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://web:3000/api/auth/invite", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { origin: "http://web:3000", ...headers },
    }),
  );
}

const input = {
  token: "tok-123",
  name: "Duda",
  password: "senha-longa-1",
  whatsappNumber: "+55 11 98888-7777",
};

let fetchMock: MockInstance;

beforeEach(() => {
  process.env.PUBLIC_BASE_URL = "http://web:3000";
  process.env.API_BASE_URL = "http://api:3001";
  process.env.INTERNAL_API_SECRET = "secret";
  fetchMock = vi.spyOn(global, "fetch");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invite accept route", () => {
  it("refuses a request from another site without calling the API", async () => {
    const res = await accept(input, { origin: "https://evil.example" });
    await expectProblem(res, 403, "Origem não permitida.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the invite with the internal secret and the visitor's IP", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        sessionToken: "session-abc",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );
    await accept(input, { "x-real-ip": "179.129.216.37" });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://api:3001/auth/invites/accept");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-internal-secret")).toBe("secret");
    expect(headers.get("x-client-ip")).toBe("179.129.216.37");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("signs the new member in by setting the session cookie", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        sessionToken: "session-abc",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );
    const res = await accept(input);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("closeout_session=session-abc");
    expect(cookie).toContain("HttpOnly");
  });

  it("sets no cookie and answers with the generic failure when the session body is malformed", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json({ expiresAt: "2030-01-01" }));
    const res = await accept(input);
    await expectProblem(res, 502, oracle.inviteAcceptFallback);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(logged).toHaveBeenCalled();
  });

  it("passes the API's problem through with its status and sets no cookie", async () => {
    const errors = [
      { pointer: "/name", detail: "Informe seu nome." },
      {
        pointer: "/password",
        detail: "A senha precisa ter pelo menos 10 caracteres.",
      },
    ];
    fetchMock.mockResolvedValue(
      problemResponse(400, "Informe seu nome.", errors),
    );
    const res = await accept(input);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual(problem(400, "Informe seu nome.", errors));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("reports an invalid link as the API words it", async () => {
    const invalid =
      "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";
    fetchMock.mockResolvedValue(problemResponse(404, invalid));
    const res = await accept(input);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(problem(404, invalid));
  });

  it("passes a rate limit through with its Retry-After", async () => {
    const tooMany = "Muitas tentativas. Tente novamente em alguns minutos.";
    fetchMock.mockResolvedValue(
      Response.json(problem(429, tooMany), {
        status: 429,
        headers: { "Retry-After": "42" },
      }),
    );
    const res = await accept(input);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toEqual(problem(429, tooMany));
  });

  it("keeps the status and answers the generic failure when the API body is not a problem", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 502 }));
    await expectProblem(
      await accept(input),
      502,
      "Não foi possível aceitar o convite agora.",
    );
    fetchMock.mockResolvedValue(
      Response.json({ message: "Convite expirado." }, { status: 404 }),
    );
    await expectProblem(
      await accept(input),
      404,
      "Não foi possível aceitar o convite agora.",
    );
  });

  it("refuses an oversized body", async () => {
    const res = await accept({ ...input, name: "x".repeat(5000) });
    await expectProblem(res, 413, "Requisição grande demais.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
