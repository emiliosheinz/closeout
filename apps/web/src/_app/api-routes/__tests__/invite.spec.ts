/** @vitest-environment node */
import { NextRequest } from "next/server";
import type { MockInstance } from "vitest";
import { POST } from "@/_app/api-routes/invite";

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
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "Origem não permitida." });
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

  it("passes the API's messages through with its status and sets no cookie", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          message: [
            "Informe seu nome.",
            "A senha precisa ter pelo menos 10 caracteres.",
          ],
        },
        { status: 400 },
      ),
    );
    const res = await accept(input);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      message: [
        "Informe seu nome.",
        "A senha precisa ter pelo menos 10 caracteres.",
      ],
    });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("reports an invalid link as the API words it", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          message:
            "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.",
        },
        { status: 404 },
      ),
    );
    const res = await accept(input);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      message:
        "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.",
    });
  });

  it("falls back to a generic message when the API sends none", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 502 }));
    const res = await accept(input);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      message: "Não foi possível aceitar o convite agora.",
    });
  });

  it("refuses an oversized body", async () => {
    const res = await accept({ ...input, name: "x".repeat(5000) });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
