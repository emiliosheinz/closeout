/** @vitest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/_app/api-routes/login";
import oracle from "@/test/copy-oracle.json";
import { expectProblem, problem, problemResponse } from "@/test/fixtures";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function login(body: string, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://web:3000/api/auth/login", {
      method: "POST",
      body,
      headers: {
        origin: "http://web:3000",
        "content-length": String(Buffer.byteLength(body)),
        ...headers,
      },
    }),
  );
}

describe("login route body cap", () => {
  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await login(
      JSON.stringify({ email: "a@b.co", password: "x".repeat(5000) }),
    );
    await expectProblem(res, 413, "Requisição grande demais.");
  });

  it("rejects a lying content-length", async () => {
    const res = await login("x".repeat(5000), { "content-length": "10" });
    expect(res.status).toBe(413);
  });

  it("reads a body of exactly 4 KB and refuses one byte more", async () => {
    const atLimit = await login("x".repeat(4096), { "content-length": "" });
    expect(atLimit.status).toBe(400);
    const overLimit = await login("x".repeat(4097), { "content-length": "" });
    expect(overLimit.status).toBe(413);
  });

  it("rejects an oversized body sent without content-length", async () => {
    const res = await login("x".repeat(5000), { "content-length": "" });
    expect(res.status).toBe(413);
  });

  it("forwards a small multi-byte body sent without content-length", async () => {
    process.env.API_BASE_URL = "http://api:3001";
    process.env.INTERNAL_API_SECRET = "secret";
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        sessionToken: "tok",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
    );
    const password = "senhaçãó-测试-1234";
    const res = await login(JSON.stringify({ email: "a@b.co", password }), {
      "content-length": "",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("closeout_session=tok");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "a@b.co",
      password,
    });
    fetchMock.mockRestore();
  });

  it("sets no cookie and answers with the generic failure when the session body is malformed", async () => {
    process.env.API_BASE_URL = "http://api:3001";
    process.env.INTERNAL_API_SECRET = "secret";
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ sessionToken: "tok" }),
    );
    const res = await login(
      JSON.stringify({ email: "a@b.co", password: "senha" }),
    );
    await expectProblem(res, 502, oracle.loginFallback);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(logged).toHaveBeenCalled();
  });

  it("answers 400 to a body that is not JSON", async () => {
    const res = await login("not json");
    await expectProblem(res, 400, "Requisição inválida.");
  });

  it("refuses a request from another site", async () => {
    const res = await login("{}", { origin: "https://evil.example" });
    await expectProblem(res, 403, "Origem não permitida.");
  });
});

describe("login route client IP", () => {
  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
  });

  it("keys the client by X-Real-IP, never by X-Forwarded-For", async () => {
    process.env.API_BASE_URL = "http://api:3001";
    process.env.INTERNAL_API_SECRET = "secret";
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(problemResponse(401, "E-mail ou senha inválidos."));
    await login(JSON.stringify({ email: "a@b.co", password: "wrong" }), {
      "x-real-ip": "179.129.216.37",
      "x-forwarded-for": "6.6.6.6, 46.151.194.130",
    });
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-client-ip")).toBe("179.129.216.37");
    fetchMock.mockRestore();
  });
});

describe("login route API failures", () => {
  const credentials = JSON.stringify({ email: "a@b.co", password: "senha" });

  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
    process.env.API_BASE_URL = "http://api:3001";
    process.env.INTERNAL_API_SECRET = "secret";
  });

  it("passes the API's problem through with its status and sets no cookie", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      problemResponse(401, "E-mail ou senha inválidos."),
    );
    const res = await login(credentials);
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual(
      problem(401, "E-mail ou senha inválidos."),
    );
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("passes a rate limit through with its Retry-After", async () => {
    const tooMany = "Muitas tentativas. Tente novamente em alguns minutos.";
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json(problem(429, tooMany), {
        status: 429,
        headers: { "Retry-After": "120" },
      }),
    );
    const res = await login(credentials);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("120");
    expect(await res.json()).toEqual(problem(429, tooMany));
  });

  it("words an API 400 as the login form's own copy", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      problemResponse(400, "Informe um e-mail válido.", [
        { pointer: "/email", detail: "Informe um e-mail válido." },
      ]),
    );
    await expectProblem(
      await login(credentials),
      400,
      "Informe um e-mail válido e a senha.",
    );
  });

  it("keeps the status and answers today's copy when the API body is not a problem", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 503 }),
    );
    await expectProblem(
      await login(credentials),
      503,
      "Não foi possível entrar agora.",
    );
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ message: "Bad Request" }, { status: 400 }),
    );
    await expectProblem(
      await login(credentials),
      400,
      "Informe um e-mail válido e a senha.",
    );
  });
});
