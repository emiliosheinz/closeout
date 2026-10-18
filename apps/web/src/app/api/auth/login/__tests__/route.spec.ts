/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";

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
    expect(res.status).toBe(413);
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
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
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

  it("answers 400 to a body that is not JSON", async () => {
    const res = await login("not json");
    expect(res.status).toBe(400);
  });
});
