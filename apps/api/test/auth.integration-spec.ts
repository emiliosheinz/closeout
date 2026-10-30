import { randomBytes, scrypt } from "node:crypto";
import request from "supertest";
import {
  as,
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  ORIGIN,
  PASSWORD,
  registeredRoutes,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("admin authentication", () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();
  // Fresh default IP per test: the limiter lives for the whole app instance.
  let testIp = "";
  let testCount = 0;
  const attempt = (email: string, password: string, ip = testIp) =>
    request(server())
      .post("/auth/login")
      .set("x-internal-secret", INTERNAL_SECRET)
      .set("x-client-ip", ip)
      .send({ email, password });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => {
    testIp = `203.0.113.${++testCount}`;
    return resetDatabase(ctx.dataSource);
  });
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
    expect(wrongPassword.body.detail).toBe("E-mail ou senha inválidos.");
    expect(unknownEmail.body.detail).toBe("E-mail ou senha inválidos.");
  });

  it("refuses login calls that do not come from the web server", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    const res = await request(server())
      .post("/auth/login")
      .set("Origin", ORIGIN)
      .send({ email: "loja-a@example.com", password: PASSWORD })
      .expect(403);
    expect(res.body.detail).toBe("Você não tem permissão para esta ação.");
  });

  it("returns 429 on the 11th attempt after ten failures, even with the right password", async () => {
    // Own email: the limiter lives for the whole app instance.
    await createStoreWithAdmin(ctx, "limite");
    for (let i = 0; i < 10; i++) {
      await attempt("limite@example.com", "wrong").expect(401);
    }
    const blocked = await attempt("limite@example.com", PASSWORD).expect(429);
    expect(blocked.body.detail).toBe(
      "Muitas tentativas. Tente novamente em alguns minutos.",
    );
    await attempt("limite@example.com", PASSWORD, "198.51.100.1").expect(200);
  });

  it("tells a blocked client when to retry and still refuses the right password", async () => {
    const minute = 60 * 1000;
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    try {
      await createStoreWithAdmin(ctx, "espera");
      for (let i = 0; i < 10; i++) {
        await attempt("espera@example.com", "wrong").expect(401);
      }
      clock.mockReturnValue(start + 5 * minute);
      const blocked = await attempt("espera@example.com", PASSWORD).expect(429);
      expect(blocked.headers["retry-after"]).toBe("600");
      expect(blocked.body.detail).toBe(
        "Muitas tentativas. Tente novamente em alguns minutos.",
      );
      clock.mockReturnValue(start + 15 * minute - 1);
      const lastMoment = await attempt("espera@example.com", PASSWORD).expect(
        429,
      );
      expect(lastMoment.headers["retry-after"]).toBe("1");
      clock.mockReturnValue(start + 15 * minute);
      await attempt("espera@example.com", PASSWORD).expect(200);
    } finally {
      clock.mockRestore();
    }
  });

  it("does not count refused attempts, so a blocked client is let back in when its failures expire", async () => {
    const minute = 60 * 1000;
    const start = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);
    try {
      await createStoreWithAdmin(ctx, "insiste");
      for (let i = 0; i < 10; i++) {
        await attempt("insiste@example.com", "wrong").expect(401);
      }
      clock.mockReturnValue(start + 5 * minute);
      for (let i = 0; i < 10; i++) {
        await attempt("insiste@example.com", PASSWORD).expect(429);
      }
      clock.mockReturnValue(start + 15 * minute);
      await attempt("insiste@example.com", PASSWORD).expect(200);
    } finally {
      clock.mockRestore();
    }
  });

  it("counts emails that differ only in case or surrounding spaces together", async () => {
    await createStoreWithAdmin(ctx, "caixa");
    const spellings = [
      "caixa@example.com",
      " CAIXA@example.com ",
      "Caixa@Example.COM",
    ];
    for (let i = 0; i < 10; i++) {
      await attempt(spellings[i % 3] ?? "", "wrong").expect(401);
    }
    await attempt("caixa@example.com", PASSWORD).expect(429);
  });

  it("returns 429 to an IP after thirty failures across rotating emails, even with valid credentials", async () => {
    await createStoreWithAdmin(ctx, "rotacao");
    for (let i = 0; i < 30; i++) {
      await attempt(`ninguem-${i}@example.com`, "wrong").expect(401);
    }
    await attempt("rotacao@example.com", PASSWORD).expect(429);
    await attempt("rotacao@example.com", PASSWORD, "198.51.100.2").expect(200);
  });

  it("refuses a wrong internal secret on login and on origin-less writes", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    await request(server())
      .post("/auth/login")
      .set("x-internal-secret", "not-the-secret")
      .set("x-client-ip", "203.0.113.1")
      .send({ email: "loja-a@example.com", password: PASSWORD })
      .expect(403);
    const admin = await createStoreWithAdmin(ctx, "loja-b");
    await request(server())
      .post(`/stores/${admin.storeId}/sellers`)
      .set("Cookie", admin.cookie)
      .set("x-internal-secret", "not-the-secret")
      .send({ displayName: "X" })
      .expect(403);
  });

  it("rejects a malformed email without counting it against the client", async () => {
    await createStoreWithAdmin(ctx, "formato");
    const tooLong = `${"a".repeat(243)}@example.com`;
    for (let i = 0; i < 15; i++) {
      const long = await attempt(` ${tooLong} `, "wrong").expect(400);
      expect(long.body.errors).toEqual([
        { pointer: "/email", detail: "Informe um e-mail válido." },
      ]);
      const spaced = await attempt('"a b"@x.com', "wrong").expect(400);
      expect(spaced.body.errors).toEqual([
        { pointer: "/email", detail: "Informe um e-mail válido." },
      ]);
    }
    await attempt("formato@example.com", PASSWORD).expect(200);
  });

  it("counts a short but well-formed email like any failed login", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await attempt("a@b.c", "wrong").expect(401);
      expect(res.body.detail).toBe("E-mail ou senha inválidos.");
    }
    await attempt("a@b.c", "wrong").expect(429);
  });

  it("does not count a successful login against the limit", async () => {
    await createStoreWithAdmin(ctx, "perdoa");
    for (let i = 0; i < 9; i++) {
      await attempt("perdoa@example.com", "wrong").expect(401);
    }
    await attempt("perdoa@example.com", PASSWORD).expect(200);
    for (let i = 0; i < 9; i++) {
      await attempt("perdoa@example.com", "wrong").expect(401);
    }
    await attempt("perdoa@example.com", "wrong").expect(401);
  });

  it("rejects an expired session", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    await as(ctx.app, admin.cookie).get("/me").expect(200);
    await ctx.dataSource.query(
      `UPDATE sessions SET expires_at = now() - interval '1 second'`,
    );
    await as(ctx.app, admin.cookie).get("/me").expect(401);
  });

  it("requires the forwarded client IP on internal login calls", async () => {
    await createStoreWithAdmin(ctx, "loja-a");
    const res = await request(server())
      .post("/auth/login")
      .set("x-internal-secret", INTERNAL_SECRET)
      .send({ email: "loja-a@example.com", password: PASSWORD })
      .expect(400);
    expect(res.body.detail).toBe(
      "Não foi possível identificar a origem da requisição.",
    );
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
    const missing = await request(server()).get("/me").expect(401);
    const forged = await request(server())
      .get(`/stores/${admin.storeId}/listings`)
      .set("Cookie", "closeout_session=forged")
      .expect(401);
    expect(missing.body.detail).toBe("Entre para continuar.");
    expect(forged.body.detail).toBe("Entre para continuar.");
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
    const url = `/stores/${admin.storeId}/sellers/${admin.sellerId}`;
    await request(server())
      .patch(url)
      .set("Cookie", admin.cookie)
      .set("Origin", "https://evil.example")
      .send({ displayName: "X" })
      .expect(403);
    await request(server())
      .patch(url)
      .set("Cookie", admin.cookie)
      .send({ displayName: "X" })
      .expect(403);
    await as(ctx.app, admin.cookie)
      .patch(url)
      .send({ displayName: "X" })
      .expect(200);
  });

  it("guards every route except the public catalog, media and health", () => {
    const open = registeredRoutes(ctx.app)
      .filter((route) => !route.guarded)
      .map((route) => `${route.method} ${route.path}`)
      .sort();
    expect(open).toEqual([
      "GET /health",
      "GET /media/:file",
      "GET /public/stores",
      "GET /public/stores/:storeSlug",
      "GET /public/stores/:storeSlug/listings",
      "GET /public/stores/:storeSlug/listings/:listingSlug",
    ]);
  });

  it("upgrades a stored hash with older parameters on successful login", async () => {
    await createStoreWithAdmin(ctx, "antigo");
    const salt = randomBytes(16);
    const key = await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        PASSWORD,
        salt,
        64,
        { N: 2 ** 15, r: 8, p: 1, maxmem: 256 * 2 ** 15 * 8 },
        (err, derived) => (err ? reject(err) : resolve(derived)),
      ),
    );
    const legacy = `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
    await ctx.dataSource.query(
      `UPDATE users SET password_hash = $1 WHERE email = 'antigo@example.com'`,
      [legacy],
    );

    await attempt("antigo@example.com", PASSWORD, "198.51.100.20").expect(200);
    const [row] = await ctx.dataSource.query(
      `SELECT password_hash FROM users WHERE email = 'antigo@example.com'`,
    );
    expect(row.password_hash).not.toBe(legacy);
    expect(row.password_hash).toMatch(/^scrypt\$32768\$8\$3\$/);
    await attempt("antigo@example.com", PASSWORD, "198.51.100.20").expect(200);
    await attempt("antigo@example.com", "wrong", "198.51.100.20").expect(401);
  });

  it("drops the user's expired and revoked sessions when a new one is minted", async () => {
    const a = await createStoreWithAdmin(ctx, "sessoes-a");
    await createStoreWithAdmin(ctx, "sessoes-b");
    const insert = (
      email: string,
      hash: string,
      expires: string,
      revoked: string,
    ) =>
      ctx.dataSource.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, revoked_at)
         SELECT id, $2, ${expires}, ${revoked} FROM users WHERE email = $1`,
        [email, hash],
      );
    const past = "now() - interval '1 day'";
    const future = "now() + interval '1 day'";
    await insert("sessoes-a@example.com", "a-expired", past, "NULL");
    await insert("sessoes-a@example.com", "a-revoked", future, "now()");
    await insert("sessoes-b@example.com", "b-expired", past, "NULL");
    await insert("sessoes-b@example.com", "b-revoked", future, "now()");

    await attempt(a.email, PASSWORD, "198.51.100.30").expect(200);

    const rows = await ctx.dataSource.query(
      `SELECT token_hash FROM sessions WHERE token_hash LIKE '%-expired' OR token_hash LIKE '%-revoked'`,
    );
    expect(
      rows.map((row: { token_hash: string }) => row.token_hash).sort(),
    ).toEqual(["b-expired", "b-revoked"]);
    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE u.email = 'sessoes-a@example.com' AND s.revoked_at IS NULL AND s.expires_at > now()`,
    );
    expect(count).toBe(2);
    await as(ctx.app, a.cookie).get("/me").expect(200);
  });
});
