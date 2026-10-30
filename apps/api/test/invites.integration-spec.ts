import request from "supertest";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  internalPost,
  ORIGIN,
  resetDatabase,
  type TestContext,
} from "./helpers";

const INVITE_INVALID =
  "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";
const HAS_ACCOUNT = "Este e-mail já tem uma conta.";
const TOO_MANY = "Muitas tentativas. Tente novamente em alguns minutos.";
const INVITE_NOT_FOUND = "Convite não encontrado.";
const INVALID_BODY = {
  type: "about:blank",
  title: "Not Found",
  status: 404,
  detail: INVITE_INVALID,
  requestId: expect.any(String),
};
const WEEK_MS = 168 * 60 * 60 * 1000;
const NEW_PASSWORD = "senha-forte-123";

describe("store invites", () => {
  let ctx: TestContext;
  let owner: Admin;
  // A fresh client IP per test: the attempt limiter lives as long as the app.
  let ip = "";
  let ipCount = 0;
  const invites = () => `/stores/${owner.storeId}/invites`;
  const asOwner = () => as(ctx.app, owner.cookie);

  const invite = async (
    email: string,
    role = "seller",
    cookie = owner.cookie,
  ): Promise<{ id: string; token: string; expiresAt: string }> => {
    const res = await as(ctx.app, cookie)
      .post(invites())
      .send({ email, role })
      .expect(201);
    return {
      id: res.body.invite.id,
      token: tokenOf(res.body.link),
      expiresAt: res.body.invite.expiresAt,
    };
  };
  const tokenOf = (link: string) => link.split("/invite/")[1] ?? "";
  const lookup = (token: string, from = ip) =>
    internalPost(ctx.app, "/auth/invites/lookup", from).send({ token });
  const accept = (
    token: string,
    fields: Record<string, unknown> = {},
    from = ip,
  ) =>
    internalPost(ctx.app, "/auth/invites/accept", from).send({
      token,
      name: "Nova Pessoa",
      password: NEW_PASSWORD,
      ...fields,
    });
  const count = async (sql: string, params: unknown[] = []) =>
    (await ctx.dataSource.query(sql, params))[0].count as number;
  const usersWithEmail = (email: string) =>
    count(`SELECT COUNT(*)::int AS count FROM users WHERE email = $1`, [email]);
  const expectRoughlyAWeekFrom = (expiresAt: string, from: number) => {
    const delta = new Date(expiresAt).getTime() - (from + WEEK_MS);
    expect(Math.abs(delta)).toBeLessThan(60_000);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    ipCount += 1;
    ip = `203.0.113.${ipCount}`;
    await resetDatabase(ctx.dataSource);
    owner = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  describe("managing invites", () => {
    it("returns a one-time link built from the public address, not the request host", async () => {
      const before = Date.now();
      const res = await asOwner()
        .post(invites())
        .set("Host", "evil.example")
        .send({ email: "  Nova@Example.com ", role: "seller" })
        .expect(201);
      expect(res.body.link).toMatch(
        /^http:\/\/storefront\.test\/invite\/[A-Za-z0-9_-]{43}$/,
      );
      expect(res.body.invite).toEqual({
        id: expect.any(String),
        email: "nova@example.com",
        role: "seller",
        expiresAt: expect.any(String),
      });
      expectRoughlyAWeekFrom(res.body.invite.expiresAt, before);
    });

    it("lists pending invites without their links", async () => {
      const created = await invite("nova@example.com", "admin");
      const res = await asOwner().get(invites()).expect(200);
      expect(res.body).toEqual({
        items: [
          {
            id: created.id,
            email: "nova@example.com",
            role: "admin",
            expiresAt: created.expiresAt,
          },
        ],
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(created.token);
      expect(raw).not.toContain("/invite/");
    });

    it("rejects owner or unknown roles", async () => {
      for (const role of ["owner", "foo", undefined]) {
        await asOwner()
          .post(invites())
          .send({ email: "nova@example.com", role })
          .expect(400);
      }
      expect(
        await count(`SELECT COUNT(*)::int AS count FROM store_invites`),
      ).toBe(0);
    });

    it("rejects an invalid email with a Portuguese message", async () => {
      for (const email of ["", "   ", "nao-e-email", "a@b", 42]) {
        const res = await asOwner()
          .post(invites())
          .send({ email, role: "seller" })
          .expect(400);
        expect(res.body.errors).toEqual([
          { pointer: "/email", detail: "Informe um e-mail válido." },
        ]);
      }
    });

    it("reports every required field of an empty invite", async () => {
      const res = await asOwner()
        .post(invites())
        .set("Content-Type", "application/json")
        .expect(400);
      expect(res.body.detail).toBe("Informe um e-mail válido.");
      expect(res.body.errors).toEqual([
        { pointer: "/email", detail: "Informe um e-mail válido." },
        { pointer: "/role", detail: "Escolha o papel da pessoa." },
      ]);
    });

    it("refuses emails that already have an account, wherever it belongs", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      await ctx.dataSource.query(
        `INSERT INTO users (email, name, password_hash) VALUES ('solta@example.com', 'Solta', 'x')`,
      );
      for (const email of [
        owner.email,
        other.email,
        "solta@example.com",
        " LOJA-A@Example.com ",
      ]) {
        const res = await asOwner()
          .post(invites())
          .send({ email, role: "seller" })
          .expect(409);
        expect(res.body.detail).toBe(HAS_ACCOUNT);
      }
      expect(
        await count(`SELECT COUNT(*)::int AS count FROM store_invites`),
      ).toBe(0);
    });

    it("replaces the pending invite when the same email is invited again", async () => {
      const first = await invite("nova@example.com", "seller");
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() + interval '1 hour'`,
      );
      const before = Date.now();
      const second = await invite("NOVA@example.com", "admin");

      await lookup(first.token).expect(404);
      await lookup(second.token).expect(200);
      const rows = await ctx.dataSource.query(
        `SELECT email, role FROM store_invites`,
      );
      expect(rows).toEqual([{ email: "nova@example.com", role: "admin" }]);
      expectRoughlyAWeekFrom(second.expiresAt, before);
    });

    it("drops expired invites from the list and purges them on the next invite", async () => {
      const expired = await invite("velha@example.com");
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() - interval '1 minute'`,
      );
      const list = await asOwner().get(invites()).expect(200);
      expect(list.body.items).toEqual([]);
      const revoked = await asOwner()
        .delete(`${invites()}/${expired.id}`)
        .expect(404);
      const regenerated = await asOwner()
        .post(`${invites()}/${expired.id}/regenerate`)
        .expect(404);
      expect(revoked.body.detail).toBe(INVITE_NOT_FOUND);
      expect(regenerated.body.detail).toBe(INVITE_NOT_FOUND);

      await invite("nova@example.com");
      const emails = await ctx.dataSource.query(
        `SELECT email FROM store_invites`,
      );
      expect(emails).toEqual([{ email: "nova@example.com" }]);
    });

    it("revokes an invite, removing it from the list and invalidating its link", async () => {
      const created = await invite("nova@example.com");
      await asOwner().delete(`${invites()}/${created.id}`).expect(204);
      expect((await asOwner().get(invites()).expect(200)).body.items).toEqual(
        [],
      );
      await lookup(created.token).expect(404);
      await asOwner().delete(`${invites()}/${created.id}`).expect(404);
    });

    it("regenerates a link, invalidating the previous one and restarting the week", async () => {
      const created = await invite("nova@example.com");
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() + interval '1 hour'`,
      );
      const before = Date.now();
      const res = await asOwner()
        .post(`${invites()}/${created.id}/regenerate`)
        .expect(200);
      const token = tokenOf(res.body.link);
      expect(res.body.link).toMatch(/^http:\/\/storefront\.test\/invite\//);
      expect(token).not.toBe(created.token);
      expect(res.body.invite).toMatchObject({
        id: created.id,
        email: "nova@example.com",
      });
      expectRoughlyAWeekFrom(res.body.invite.expiresAt, before);
      await lookup(created.token).expect(404);
      await lookup(token).expect(200);
    });

    it("answers 404 for another store's invite and leaves it valid", async () => {
      const created = await invite("nova@example.com");
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const intruder = as(ctx.app, other.cookie);
      const path = `/stores/${other.storeId}/invites/${created.id}`;
      await intruder.delete(path).expect(404);
      await intruder.post(`${path}/regenerate`).expect(404);
      await intruder.delete(`${invites()}/${created.id}`).expect(404);
      await lookup(created.token).expect(200);
    });
  });

  describe("opening and accepting a link", () => {
    it("shows the store name, the invited email and the role for a valid link", async () => {
      const { token } = await invite("nova@example.com", "admin");
      const res = await lookup(token).expect(200);
      expect(res.body).toEqual({
        storeName: "Loja loja-a",
        email: "nova@example.com",
        role: "admin",
      });
    });

    it("answers every kind of invalid link identically", async () => {
      const revoked = await invite("revogado@example.com");
      await asOwner().delete(`${invites()}/${revoked.id}`).expect(204);
      const replaced = await invite("trocado@example.com");
      await invite("trocado@example.com", "admin");
      const regenerated = await invite("regenerado@example.com");
      await asOwner()
        .post(`${invites()}/${regenerated.id}/regenerate`)
        .expect(200);
      const used = await invite("usado@example.com");
      await accept(used.token).expect(200);
      const expired = await invite("expirado@example.com");
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() - interval '1 second' WHERE id = $1`,
        [expired.id],
      );

      const reasons = {
        unknown: "token-que-nao-existe",
        expired: expired.token,
        revoked: revoked.token,
        replaced: replaced.token,
        regenerated: regenerated.token,
        used: used.token,
      };
      for (const [index, token] of Object.values(reasons).entries()) {
        const from = `198.18.${ipCount}.${index}`;
        const opened = await lookup(token, from).expect(404);
        expect(opened.body).toEqual(INVALID_BODY);
        const submitted = await accept(token, {}, from).expect(404);
        expect(submitted.body).toEqual(INVALID_BODY);
      }
    });

    it("answers an unmatched token of up to 200 characters as an invalid link", async () => {
      const unmatched = "x".repeat(200);
      expect((await lookup(unmatched).expect(404)).body).toEqual(INVALID_BODY);
      expect((await accept(unmatched).expect(404)).body).toEqual(INVALID_BODY);
    });

    it("rejects an empty or over-long token as malformed", async () => {
      for (const token of ["", "x".repeat(201)]) {
        const opened = await lookup(token).expect(400);
        expect(opened.body.errors).toEqual([
          { pointer: "/token", detail: "Valor inválido." },
        ]);
        const submitted = await accept(token).expect(400);
        expect(submitted.body.errors).toEqual([
          { pointer: "/token", detail: "Valor inválido." },
        ]);
      }
    });

    it("treats a link as invalid from the moment it expires", async () => {
      const { id, token } = await invite("nova@example.com");
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() + interval '1 second' WHERE id = $1`,
        [id],
      );
      await lookup(token).expect(200);
      await ctx.dataSource.query(
        `UPDATE store_invites SET expires_at = now() WHERE id = $1`,
        [id],
      );
      await lookup(token).expect(404);
    });

    it("creates exactly the invited member and signs them in", async () => {
      const { token } = await invite("nova@example.com", "seller");
      const res = await accept(token, {
        name: "  Nova Pessoa  ",
        whatsappNumber: "+55 21 97777-1234",
      }).expect(200);
      expect(res.body).toEqual({
        sessionToken: expect.any(String),
        expiresAt: expect.any(String),
      });

      const me = await as(ctx.app, `closeout_session=${res.body.sessionToken}`)
        .get("/me")
        .expect(200);
      expect(me.body.user).toMatchObject({
        name: "Nova Pessoa",
        email: "nova@example.com",
      });
      expect(me.body.memberships).toEqual([
        {
          role: "seller",
          sellerId: expect.any(String),
          store: expect.objectContaining({ id: owner.storeId }),
        },
      ]);
      const profiles = await ctx.dataSource.query(
        `SELECT s.display_name, s.whatsapp_number, s.store_id
           FROM sellers s JOIN users u ON u.id = s.user_id
          WHERE u.email = 'nova@example.com'`,
      );
      expect(profiles).toEqual([
        {
          display_name: "Nova Pessoa",
          whatsapp_number: "5521977771234",
          store_id: owner.storeId,
        },
      ]);
      await lookup(token).expect(404);
    });

    it("tells the new member to sign in when the account exists but no session could be opened", async () => {
      const { token } = await invite("nova@example.com");
      await ctx.dataSource.query(`
        CREATE FUNCTION refuse_sessions() RETURNS trigger LANGUAGE plpgsql
          AS $$ BEGIN RAISE EXCEPTION 'sessions unavailable'; END $$;
        CREATE TRIGGER refuse_sessions BEFORE INSERT ON sessions
          FOR EACH ROW EXECUTE FUNCTION refuse_sessions();
      `);
      try {
        const res = await accept(token).expect(500);
        expect(res.body.detail).toBe(
          "Sua conta foi criada, mas não foi possível entrar. Entre com seu e-mail e senha.",
        );
      } finally {
        await ctx.dataSource.query(`
          DROP TRIGGER refuse_sessions ON sessions;
          DROP FUNCTION refuse_sessions();
        `);
      }
      expect(await usersWithEmail("nova@example.com")).toBe(1);
    });

    it("creates an admin without WhatsApp when none is given", async () => {
      const { token } = await invite("nova@example.com", "admin");
      await accept(token, { whatsappNumber: "" }).expect(200);
      const [row] = await ctx.dataSource.query(
        `SELECT m.role, s.whatsapp_number
           FROM users u
           JOIN store_members m ON m.user_id = u.id
           JOIN sellers s ON s.user_id = u.id
          WHERE u.email = 'nova@example.com'`,
      );
      expect(row).toEqual({ role: "admin", whatsapp_number: null });
    });

    it.each([
      "admin",
      "seller",
    ])("gives the accepted member exactly the invited role %s", async (role) => {
      const { token } = await invite("nova@example.com", role);
      await accept(token).expect(200);
      const rows = await ctx.dataSource.query(
        `SELECT m.store_id, m.role FROM store_members m
           JOIN users u ON u.id = m.user_id WHERE u.email = 'nova@example.com'`,
      );
      expect(rows).toEqual([{ store_id: owner.storeId, role }]);
    });

    it("refuses a second accept of the same link", async () => {
      const { token } = await invite("nova@example.com");
      await accept(token).expect(200);
      const again = await accept(token, { password: "outra-senha-123" });
      expect(again.status).toBe(404);
      expect(again.body).toEqual(INVALID_BODY);
      expect(await usersWithEmail("nova@example.com")).toBe(1);
    });

    it("creates one account when the same link is accepted twice at once", async () => {
      const { token } = await invite("nova@example.com");
      const results = await Promise.all([accept(token), accept(token)]);
      expect(results.map((res) => res.status).sort()).toEqual([200, 404]);
      const refused = results.find((res) => res.status === 404);
      expect(refused?.body).toEqual(INVALID_BODY);
      expect(await usersWithEmail("nova@example.com")).toBe(1);
      expect(
        await count(
          `SELECT COUNT(*)::int AS count FROM store_members m
             JOIN users u ON u.id = m.user_id WHERE u.email = 'nova@example.com'`,
        ),
      ).toBe(1);
    });

    it("rejects invalid details without creating anything or spending the link", async () => {
      const { token } = await invite("nova@example.com");
      const cases = [
        [
          { password: "123456789" },
          "A senha precisa ter pelo menos 10 caracteres.",
        ],
        [{ name: "   " }, "Informe seu nome."],
        [
          { whatsappNumber: "11 99999-8888" },
          "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
        ],
      ] as const;
      for (const [fields, message] of cases) {
        const res = await accept(token, fields).expect(400);
        expect(res.body.errors).toEqual([
          { pointer: `/${Object.keys(fields)[0]}`, detail: message },
        ]);
      }
      expect(await usersWithEmail("nova@example.com")).toBe(0);
      await lookup(token).expect(200);
    });

    it("consumes the invite and refuses when the email got an account in the meantime", async () => {
      const { token } = await invite("nova@example.com");
      await addMember(ctx, owner, {
        email: "nova@example.com",
        name: "Pela CLI",
      });

      const res = await accept(token).expect(409);
      expect(res.body.detail).toBe(HAS_ACCOUNT);
      await lookup(token).expect(404);
      const users = await ctx.dataSource.query(
        `SELECT name FROM users WHERE email = 'nova@example.com'`,
      );
      expect(users).toEqual([{ name: "Pela CLI" }]);
    });

    it("keeps an invite valid after its inviter is demoted or removed", async () => {
      const inviter = await addMember(ctx, owner, {
        email: "socia@example.com",
        name: "Sócia",
      });
      const members = `/stores/${owner.storeId}/members`;
      const first = await invite("um@example.com", "seller", inviter.cookie);
      const second = await invite("dois@example.com", "seller", inviter.cookie);

      await asOwner()
        .patch(`${members}/${inviter.userId}`)
        .send({ role: "seller" })
        .expect(200);
      await accept(first.token).expect(200);

      await asOwner().delete(`${members}/${inviter.userId}`).expect(204);
      await accept(second.token).expect(200);
    });
  });

  describe("abuse controls", () => {
    it("blocks a client after ten invalid attempts while other clients keep working", async () => {
      const { token } = await invite("nova@example.com");
      for (let i = 0; i < 5; i++) {
        await lookup(`desconhecido-${i}`).expect(404);
        await accept(`desconhecido-${i}`).expect(404);
      }
      const blockedLookup = await lookup(token).expect(429);
      expect(blockedLookup.body.detail).toBe(TOO_MANY);
      const blockedAccept = await accept(token).expect(429);
      expect(blockedAccept.body.detail).toBe(TOO_MANY);
      expect(await usersWithEmail("nova@example.com")).toBe(0);

      const elsewhere = "192.0.2.200";
      await lookup(token, elsewhere).expect(200);
      await accept(token, {}, elsewhere).expect(200);
    });

    it("does not count valid links against the client", async () => {
      const { token } = await invite("nova@example.com");
      for (let i = 0; i < 12; i++) await lookup(token).expect(200);
      for (let i = 0; i < 9; i++) await lookup(`desconhecido-${i}`).expect(404);
      await lookup(token).expect(200);
      await accept(token).expect(200);
      await lookup("desconhecido-9").expect(404);
      const blocked = await lookup("desconhecido-10").expect(429);
      expect(blocked.body.detail).toBe(TOO_MANY);
    });

    it("lets a blocked client try again once 15 minutes have passed", async () => {
      const start = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(start);
      try {
        const { token } = await invite("nova@example.com");
        for (let i = 0; i < 10; i++) {
          await lookup(`desconhecido-${i}`).expect(404);
        }
        clock.mockReturnValue(start + 15 * 60 * 1000 - 1);
        await lookup(token).expect(429);
        clock.mockReturnValue(start + 15 * 60 * 1000);
        await lookup(token).expect(200);
      } finally {
        clock.mockRestore();
      }
    });

    it("tells a blocked client when to retry", async () => {
      const minute = 60 * 1000;
      const start = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(start);
      try {
        const { token } = await invite("nova@example.com");
        for (let i = 0; i < 10; i++) {
          await lookup(`desconhecido-${i}`).expect(404);
        }
        clock.mockReturnValue(start + 5 * minute);
        const blockedLookup = await lookup(token).expect(429);
        expect(blockedLookup.headers["retry-after"]).toBe("600");
        expect(blockedLookup.body.detail).toBe(TOO_MANY);
        clock.mockReturnValue(start + 15 * minute - 1);
        const blockedAccept = await accept(token).expect(429);
        expect(blockedAccept.headers["retry-after"]).toBe("1");
        expect(blockedAccept.body.detail).toBe(TOO_MANY);
      } finally {
        clock.mockRestore();
      }
    });

    it("counts only invalid links, not accepted, existing-account or sign-in-failed outcomes", async () => {
      const existing = await invite("existente@example.com");
      await addMember(ctx, owner, {
        email: "existente@example.com",
        name: "Pela CLI",
      });
      const valid = await invite("nova@example.com");
      const unlucky = await invite("azar@example.com");
      for (let i = 0; i < 9; i++) await lookup(`desconhecido-${i}`).expect(404);

      await accept(existing.token).expect(409);
      await accept(valid.token).expect(200);
      await ctx.dataSource.query(`
        CREATE FUNCTION refuse_sessions() RETURNS trigger LANGUAGE plpgsql
          AS $$ BEGIN RAISE EXCEPTION 'sessions unavailable'; END $$;
        CREATE TRIGGER refuse_sessions BEFORE INSERT ON sessions
          FOR EACH ROW EXECUTE FUNCTION refuse_sessions();
      `);
      try {
        await accept(unlucky.token).expect(500);
      } finally {
        await ctx.dataSource.query(`
          DROP TRIGGER refuse_sessions ON sessions;
          DROP FUNCTION refuse_sessions();
        `);
      }

      await lookup("desconhecido-9").expect(404);
      const blocked = await lookup("desconhecido-10").expect(429);
      expect(blocked.body.detail).toBe(TOO_MANY);
    });

    it("answers only internal calls that carry the visitor's IP", async () => {
      const { token } = await invite("nova@example.com");
      const server = ctx.app.getHttpServer();
      const calls = [
        ["/auth/invites/lookup", { token }],
        [
          "/auth/invites/accept",
          { token, name: "Nova", password: NEW_PASSWORD },
        ],
      ] as const;
      for (const [path, body] of calls) {
        const external = await request(server)
          .post(path)
          .set("Origin", ORIGIN)
          .set("x-client-ip", ip)
          .send(body)
          .expect(403);
        expect(external.body.detail).toBe(
          "Você não tem permissão para esta ação.",
        );
        const withoutIp = await request(server)
          .post(path)
          .set("x-internal-secret", INTERNAL_SECRET)
          .send(body)
          .expect(400);
        expect(withoutIp.body.detail).toBe(
          "Não foi possível identificar a origem da requisição.",
        );
      }
      await lookup(token).expect(200);
    });
  });
});
