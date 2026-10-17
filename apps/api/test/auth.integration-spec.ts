import request from "supertest";
import {
  as,
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("admin authentication", () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  const attempt = (email: string, password: string, ip = "203.0.113.7") =>
    request(server())
      .post("/auth/login")
      .set("x-internal-secret", INTERNAL_SECRET)
      .set("x-client-ip", ip)
      .send({ email, password });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDatabase(ctx.dataSource));
  afterAll(() => ctx.app.close());

  it("stores the password as a salted scrypt hash", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    const [row] = await ctx.dataSource.query(
      `SELECT password_hash FROM users WHERE email = 'loja-a@example.com'`,
    );
    expect(row.password_hash).toMatch(/^scrypt\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });

  it("answers wrong password and unknown email with the same generic 401", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    const wrongPassword = await attempt("loja-a@example.com", "nope").expect(
      401,
    );
    const unknownEmail = await attempt("ghost@example.com", PASSWORD).expect(
      401,
    );
    expect(wrongPassword.body.message).toBe("E-mail ou senha inválidos.");
    expect(unknownEmail.body.message).toBe("E-mail ou senha inválidos.");
  });

  it("refuses login calls that do not come from the web server", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    await request(server())
      .post("/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "loja-a@example.com", password: PASSWORD })
      .expect(403);
  });

  it("returns 429 on the 11th attempt after ten failures, even with the right password", async () => {
    // Own email: the limiter lives for the whole app instance.
    await createStoreWithAdmin(ctx, "limite");
    for (let i = 0; i < 10; i++) {
      await attempt("limite@example.com", "wrong").expect(401);
    }
    const blocked = await attempt("limite@example.com", PASSWORD).expect(429);
    expect(blocked.body.message).toMatch(/Muitas tentativas/);
    await attempt("limite@example.com", PASSWORD, "198.51.100.1").expect(200);
  });

  it("requires the forwarded client IP on internal login calls", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    await request(server())
      .post("/auth/login")
      .set("x-internal-secret", INTERNAL_SECRET)
      .send({ email: "loja-a@example.com", password: PASSWORD })
      .expect(400);
  });

  it("does not let a burst of concurrent guesses exceed the limit", async () => {
    await createStoreWithAdmin(ctx, "rajada");
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        attempt("rajada@example.com", "wrong", "203.0.113.99"),
      ),
    );
    const statuses = results.map((res) => res.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
  });

  it("rejects admin endpoints without a valid session", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    await request(server()).get("/me").expect(401);
    await request(server())
      .get(`/stores/${admin.storeId}/listings`)
      .set("Cookie", "closeout_session=forged")
      .expect(401);
  });

  it("revokes the session on logout", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    const client = as(ctx.app, admin.cookie);
    await client.get("/me").expect(200);
    await client.post("/auth/logout").expect(204);
    await client.get("/me").expect(401);
  });

  it("rejects mutating requests from a foreign or missing Origin", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    const url = `/stores/${admin.storeId}/sellers`;
    await request(server())
      .post(url)
      .set("Cookie", admin.cookie)
      .set("Origin", "https://evil.example")
      .send({ displayName: "X" })
      .expect(403);
    await request(server())
      .post(url)
      .set("Cookie", admin.cookie)
      .send({ displayName: "X" })
      .expect(403);
    await as(ctx.app, admin.cookie)
      .post(url)
      .send({ displayName: "X" })
      .expect(201);
  });

  it("does not expose any route that creates users", async () => {
    for (const path of ["/users", "/auth/register", "/auth/signup", "/me"]) {
      await request(server())
        .post(path)
        .set("Origin", ORIGIN)
        .send({ email: "new@example.com", password: PASSWORD })
        .expect((res) => {
          expect([401, 404]).toContain(res.status);
        });
    }
    const [{ count }] = await ctx.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM users`,
    );
    expect(count).toBe(0);
  });
});
