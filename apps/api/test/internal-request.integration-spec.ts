import request from "supertest";
import {
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  type TestContext,
} from "./helpers";

const FORBIDDEN = "Você não tem permissão para esta ação.";
const NO_CLIENT_IP = "Não foi possível identificar a origem da requisição.";

describe("internal request guard", () => {
  let ctx: TestContext;
  // Fresh IPs and emails per test: the limiters live as long as the app.
  let testCount = 0;
  let ip = "";
  const post = (path: string, headers: Record<string, string>) =>
    request(ctx.app.getHttpServer()).post(path).set(headers);
  const internal = (from: string) => ({
    "x-internal-secret": INTERNAL_SECRET,
    "x-client-ip": from,
  });
  const login = (email: string, password: string, from = ip) =>
    post("/auth/login", internal(from)).send({ email, password });
  const lookup = (token: string, from = ip) =>
    post("/auth/invites/lookup", internal(from)).send({ token });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => {
    ip = `198.18.0.${++testCount}`;
    return resetDatabase(ctx.dataSource);
  });
  afterAll(() => ctx.app.close());

  it("keys the limit on the forwarded client IP only when the secret is valid", async () => {
    await createStoreWithAdmin(ctx, "chave");
    for (let i = 0; i < 10; i++) {
      await login("chave@example.com", "wrong").expect(401);
    }
    await login("chave@example.com", PASSWORD).expect(429);
    await login("chave@example.com", PASSWORD, "198.18.1.1").expect(200);

    for (const secret of [undefined, "not-the-secret"]) {
      const res = await post("/auth/login", {
        Origin: ORIGIN,
        "x-client-ip": "198.18.1.1",
        ...(secret && { "x-internal-secret": secret }),
      })
        .send({ email: "chave@example.com", password: PASSWORD })
        .expect(403);
      expect(res.body.detail).toBe(FORBIDDEN);
    }
  });

  it("refuses calls without the secret before reading the body, and does not count them", async () => {
    await createStoreWithAdmin(ctx, "externo");
    const external = { Origin: ORIGIN, "x-client-ip": ip };
    const calls = [
      ["/auth/login", { email: "externo@example.com", password: "wrong" }],
      ["/auth/login", { email: "not-an-email" }],
      ["/auth/invites/lookup", { token: "desconhecido" }],
      ["/auth/invites/lookup", { token: "" }],
      ["/auth/invites/accept", { token: "desconhecido", name: "X" }],
    ] as const;
    for (let i = 0; i < 12; i++) {
      for (const [path, body] of calls) {
        const res = await post(path, external).send(body).expect(403);
        expect(res.body.detail).toBe(FORBIDDEN);
      }
    }

    for (let i = 0; i < 10; i++) {
      await login("externo@example.com", "wrong").expect(401);
      await lookup(`desconhecido-${i}`).expect(404);
    }
    await login("externo@example.com", PASSWORD).expect(429);
    await lookup("desconhecido-10").expect(429);
  });

  it("answers 400 to internal calls without a client IP and does not count them", async () => {
    await createStoreWithAdmin(ctx, "semip");
    const secretOnly = { "x-internal-secret": INTERNAL_SECRET };
    for (let i = 0; i < 30; i++) {
      const res = await post("/auth/login", secretOnly)
        .send({ email: "semip@example.com", password: "wrong" })
        .expect(400);
      expect(res.body.detail).toBe(NO_CLIENT_IP);
    }
    for (const path of ["/auth/invites/lookup", "/auth/invites/accept"]) {
      const res = await post(path, secretOnly)
        .send({ token: "desconhecido" })
        .expect(400);
      expect(res.body.detail).toBe(NO_CLIENT_IP);
    }
    await login("semip@example.com", PASSWORD).expect(200);
  });

  it("does not count internal calls rejected for an invalid body", async () => {
    await createStoreWithAdmin(ctx, "corpo");
    // 21 + 9 would reach the IP's limit of 30 if the invalid bodies counted.
    for (let i = 0; i < 21; i++) {
      await login("not-an-email", "wrong").expect(400);
      await lookup("").expect(400);
    }
    for (let i = 0; i < 9; i++) {
      await login("corpo@example.com", "wrong").expect(401);
      await lookup(`desconhecido-${i}`).expect(404);
    }
    await login("corpo@example.com", PASSWORD).expect(200);
    await lookup("desconhecido-9").expect(404);
    await lookup("desconhecido-10").expect(429);
  });
});
