/** @vitest-environment node */

import { NextRequest } from "next/server";
import type { MockInstance } from "vitest";
import { POST } from "@/_app/api-routes/waitlist";
import { expectProblem, problem, problemResponse } from "@/test/fixtures";

const FAILED = "Não foi possível entrar na lista agora.";

function signup(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("http://web:3000/api/waitlist", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { origin: "http://web:3000", ...headers },
    }),
  );
}

const input = {
  name: "Duda",
  channel: "email",
  contact: "duda@example.com",
  ref: "loja-x",
  src: "landing",
  website: "",
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

describe("waitlist relay route", () => {
  it("refuses a request from another site without calling the API", async () => {
    const res = await signup(input, { origin: "https://evil.example" });
    await expectProblem(res, 403, "Origem não permitida.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a request without an origin without calling the API", async () => {
    const res = await POST(
      new NextRequest("http://web:3000/api/waitlist", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    await expectProblem(res, 403, "Origem não permitida.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an oversized body without calling the API", async () => {
    const res = await signup({ ...input, name: "x".repeat(5000) });
    await expectProblem(res, 413, "Requisição grande demais.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a JSON array", "[1,2]"],
    ["a JSON string", '"oi"'],
    ["null", "null"],
    ["text that is not JSON", "nope"],
  ])("refuses %s without calling the API", async (_label, body) => {
    const res = await signup(body);
    await expectProblem(res, 400, "Requisição inválida.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only the signup fields with the internal secret and the visitor's IP", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await signup(
      { ...input, extra: "x", admin: true },
      { "x-real-ip": "179.129.216.37" },
    );
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://api:3001/waitlist/signups");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-internal-secret")).toBe("secret");
    expect(headers.get("x-client-ip")).toBe("179.129.216.37");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it("leaves out the optional fields the browser did not send", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await signup({
      name: "Duda",
      channel: "email",
      contact: "duda@example.com",
    });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Duda",
      channel: "email",
      contact: "duda@example.com",
    });
  });

  it("answers 204 with an empty body when the API accepts", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await signup(input);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("passes the API's problem through with its status and body", async () => {
    const errors = [{ pointer: "/name", detail: "Informe seu nome." }];
    fetchMock.mockResolvedValue(
      problemResponse(400, "Informe seu nome.", errors),
    );
    const res = await signup(input);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toEqual(problem(400, "Informe seu nome.", errors));
  });

  it("passes a rate limit through with its Retry-After", async () => {
    const tooMany = "Muitas tentativas. Tente novamente em alguns minutos.";
    fetchMock.mockResolvedValue(
      Response.json(problem(429, tooMany), {
        status: 429,
        headers: { "Retry-After": "42" },
      }),
    );
    const res = await signup(input);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(await res.json()).toEqual(problem(429, tooMany));
  });

  it("keeps the status and answers the generic failure when the API error is not a problem", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }));
    await expectProblem(await signup(input), 503, FAILED);
  });

  it("answers 502 and logs without the signup when the API cannot be reached", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expectProblem(await signup(input), 502, FAILED);
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain("duda@example.com");
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secret");
  });

  it("answers 502 when the API takes too long", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
    await expectProblem(await signup(input), 502, FAILED);
  });
});
