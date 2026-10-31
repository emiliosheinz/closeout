import { INVALID_WHATSAPP } from "@closeout/contracts/schemas";
import type { DestinationStream } from "pino";
import request from "supertest";
import {
  createTestApp,
  INTERNAL_SECRET,
  internalPost,
  ORIGIN,
  resetDatabase,
  type TestContext,
} from "./helpers";

const INVALID_EMAIL = "Informe um e-mail válido.";
const INVALID_VALUE = "Valor inválido.";
const TOO_MANY = "Muitas tentativas. Tente novamente em alguns minutos.";
const FORBIDDEN = "Você não tem permissão para esta ação.";
const NO_CLIENT_IP = "Não foi possível identificar a origem da requisição.";
const HOUR_MS = 60 * 60 * 1000;

const valid = {
  name: "Ana",
  channel: "whatsapp",
  contact: "+55 (11) 99999-8888",
};

type LogLine = Record<string, unknown> & { msg: string; level: number };

/** A well-formed address of exactly `length` characters. */
function email(length: number): string {
  return `${"a".repeat(length - "@example.com".length)}@example.com`;
}

describe("waitlist signups", () => {
  let ctx: TestContext;
  let chunks: string[] = [];
  const logs: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };
  const lines = (): LogLine[] =>
    chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  // A fresh client IP per test: the limiter lives as long as the app.
  let ip = "";
  let ipCount = 0;
  const signup = (body: unknown, from = ip) =>
    internalPost(ctx.app, "/waitlist/signups", from).send(body as object);
  const stored = (): Promise<
    {
      name: string;
      channel: string;
      contact: string;
      ref: string | null;
      src: string | null;
      createdAt: Date;
    }[]
  > =>
    ctx.dataSource.query(
      `SELECT name, channel, contact, ref, src, created_at AS "createdAt" FROM waitlist_signups ORDER BY created_at`,
    );

  beforeAll(async () => {
    ctx = await createTestApp([], logs);
  });
  beforeEach(async () => {
    ipCount += 1;
    ip = `203.0.113.${ipCount}`;
    await resetDatabase(ctx.dataSource);
    chunks = [];
  });
  afterAll(() => ctx.app.close());

  describe("storing", () => {
    it("stores every field of a valid signup and answers 204 with no body", async () => {
      const before = Date.now() - 1000;
      const res = await signup({
        ...valid,
        ref: "loja-x",
        src: "catalog-footer",
      }).expect(204);
      expect(res.text).toBe("");

      const [row, ...others] = await stored();
      expect(others).toEqual([]);
      expect(row?.name).toBe("Ana");
      expect(row?.channel).toBe("whatsapp");
      expect(row?.contact).toBe("5511999998888");
      expect(row?.ref).toBe("loja-x");
      expect(row?.src).toBe("catalog-footer");
      expect(row?.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(row?.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("stores an e-mail trimmed and lowercased", async () => {
      await signup({
        ...valid,
        channel: "email",
        contact: "  Ana@Example.COM ",
      }).expect(204);
      expect((await stored())[0]?.contact).toBe("ana@example.com");
    });

    it("stores no ref and no src when they are absent", async () => {
      await signup(valid).expect(204);
      const [row] = await stored();
      expect(row?.ref).toBeNull();
      expect(row?.src).toBeNull();
    });

    it("stores the name trimmed", async () => {
      await signup({ ...valid, name: "  Ana  " }).expect(204);
      expect((await stored())[0]?.name).toBe("Ana");
    });

    it.each([
      ["a 100 character name", { name: "n".repeat(100) }],
      ["an 8 digit WhatsApp number", { contact: "+12345678" }],
      ["a 15 digit WhatsApp number", { contact: "+123456789012345" }],
      ["a 254 character e-mail", { channel: "email", contact: email(254) }],
    ])("accepts %s", async (_label, change) => {
      await signup({ ...valid, ...change }).expect(204);
      expect(await stored()).toHaveLength(1);
    });
  });

  describe("validation", () => {
    it.each([
      [
        "a WhatsApp number without a plus",
        { contact: "11 99999-8888" },
        "/contact",
        INVALID_WHATSAPP,
      ],
      [
        "a 7 digit WhatsApp number",
        { contact: "+1234567" },
        "/contact",
        INVALID_WHATSAPP,
      ],
      [
        "a 16 digit WhatsApp number",
        { contact: "+1234567890123456" },
        "/contact",
        INVALID_WHATSAPP,
      ],
      [
        "an e-mail without a domain",
        { channel: "email", contact: "ana@" },
        "/contact",
        INVALID_EMAIL,
      ],
      [
        "a 255 character e-mail",
        { channel: "email", contact: email(255) },
        "/contact",
        INVALID_EMAIL,
      ],
      ["a blank name", { name: "   " }, "/name", "Informe seu nome."],
      [
        "a 101 character name",
        { name: "n".repeat(101) },
        "/name",
        "Use até 100 caracteres no nome.",
      ],
      [
        "an unknown channel",
        { channel: "sms" },
        "/channel",
        "Escolha WhatsApp ou e-mail.",
      ],
      [
        "a ref with a space and a capital",
        { ref: "Loja X" },
        "/ref",
        INVALID_VALUE,
      ],
      ["a 101 character ref", { ref: "r".repeat(101) }, "/ref", INVALID_VALUE],
      ["an empty ref", { ref: "" }, "/ref", INVALID_VALUE],
      ["an unknown src", { src: "footer" }, "/src", INVALID_VALUE],
      ["an extra field", { foo: "x" }, "/foo", "Campo não permitido."],
    ])("rejects %s and stores nothing", async (_label, change, pointer, detail) => {
      const res = await signup({ ...valid, ...change }).expect(400);
      expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
      expect(res.body.errors[0]).toEqual({ pointer, detail });
      expect(await stored()).toEqual([]);
    });
  });

  describe("repeat signups", () => {
    it("accepts a repeat of the same contact and keeps the first signup", async () => {
      await signup({
        ...valid,
        ref: "loja-x",
        src: "landing",
      }).expect(204);
      const [first] = await stored();

      await signup({
        name: "Outra",
        channel: "whatsapp",
        contact: "+55 11 99999-8888",
        ref: "loja-y",
        src: "login",
      }).expect(204);

      expect(await stored()).toEqual([first]);
    });

    it("accepts two concurrent signups with the same contact and stores one", async () => {
      const results = await Promise.all([
        signup({ ...valid, name: "Ana" }),
        signup({ ...valid, name: "Ana B" }),
      ]);
      expect(results.map((res) => res.status)).toEqual([204, 204]);
      expect(await stored()).toHaveLength(1);
    });
  });

  describe("honeypot", () => {
    it("accepts and stores nothing when the website field is filled", async () => {
      await signup({ ...valid, website: "http://spam.example" }).expect(204);
      expect(await stored()).toEqual([]);
    });

    it.each([
      "",
      "   ",
    ])("stores the signup when website is %j", async (site) => {
      await signup({ ...valid, website: site }).expect(204);
      expect(await stored()).toHaveLength(1);
    });

    it("answers the validation problem when an invalid signup fills it", async () => {
      await signup({
        ...valid,
        contact: "ana@",
        website: "http://spam.example",
      }).expect(400);
    });

    it("logs one warning with the attribution", async () => {
      await signup({
        ...valid,
        ref: "loja-x",
        src: "login",
        website: "http://spam.example",
      }).expect(204);
      const hits = lines().filter(
        (line) => line.msg === "Waitlist honeypot filled",
      );
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ level: 40, ref: "loja-x", src: "login" });
    });
  });

  describe("logs", () => {
    it("log the stored signup's id and attribution", async () => {
      await signup({ ...valid, ref: "loja-x", src: "landing" }).expect(204);
      const [row] = await ctx.dataSource.query(
        `SELECT id FROM waitlist_signups`,
      );
      const entries = lines().filter(
        (line) => line.msg === "Waitlist signup stored",
      );
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        level: 30,
        signupId: row.id,
        channel: "whatsapp",
        ref: "loja-x",
        src: "landing",
      });
    });

    it("log nothing about a repeat signup being stored", async () => {
      await signup(valid).expect(204);
      await signup(valid).expect(204);
      expect(
        lines().filter((line) => line.msg === "Waitlist signup stored"),
      ).toHaveLength(1);
    });

    it("never contain the name or the contact", async () => {
      const name = "Zélia Sentinela";
      const contact = "sentinela-93@example.com";
      const body = { name, channel: "email", contact };
      await signup(body).expect(204);
      await signup({
        ...body,
        contact: "outro-93@example.com",
        website: "x",
      }).expect(204);
      for (let i = 0; i < 18; i++) await signup({ name: "x" }).expect(400);
      await signup(body).expect(429);

      expect(
        lines().some((line) => line.msg === "Waitlist signups rate limited"),
      ).toBe(true);
      const output = chunks.join("");
      expect(output).not.toContain("Sentinela");
      expect(output).not.toContain("sentinela-93");
      expect(output).not.toContain("outro-93");
    });
  });

  describe("rate limit", () => {
    const attempts = async (count: number, body: unknown = valid) => {
      for (let i = 0; i < count; i++) {
        await signup(body).expect((res) => {
          expect(res.status).toBeLessThan(500);
        });
      }
    };
    const withClock = async (
      run: (set: (at: number) => void) => Promise<void>,
    ) => {
      const start = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(start);
      try {
        await run((at) => clock.mockReturnValue(start + at));
      } finally {
        clock.mockRestore();
      }
    };

    it("refuses the 21st attempt in an hour with a retry delay and stores nothing", async () => {
      await attempts(20, { ...valid, website: "bot" });
      const res = await signup({
        ...valid,
        contact: "+55 11 98888-7777",
      }).expect(429);
      expect(res.body.detail).toBe(TOO_MANY);
      const retryAfter = Number(res.headers["retry-after"]);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(3600);
      expect(await stored()).toEqual([]);
    });

    it("counts invalid attempts", async () => {
      for (let i = 0; i < 20; i++) await signup({ name: "x" }).expect(400);
      await signup(valid).expect(429);
    });

    it("limits one IP without affecting another", async () => {
      await attempts(20, { name: "x" });
      await signup(valid).expect(429);
      await signup(valid, `${ip}0`).expect(204);
      expect(await stored()).toHaveLength(1);
    });

    it("admits a new attempt once the oldest of the 20 is an hour old", async () => {
      await withClock(async (set) => {
        await attempts(20, { name: "x" });
        set(HOUR_MS - 1);
        await signup(valid).expect(429);
        set(HOUR_MS);
        await signup(valid).expect(204);
      });
    });

    it("does not extend the wait when a limited client keeps retrying", async () => {
      await withClock(async (set) => {
        await attempts(20, { name: "x" });
        set(30 * 60 * 1000);
        for (let i = 0; i < 10; i++) await signup(valid).expect(429);
        set(HOUR_MS);
        await signup(valid).expect(204);
      });
    });
  });

  describe("internal requests only", () => {
    const unsigned = (body: unknown, headers: Record<string, string> = {}) =>
      request(ctx.app.getHttpServer())
        .post("/waitlist/signups")
        .set({ Origin: ORIGIN, "x-client-ip": ip, ...headers })
        .send(body as object);

    it("refuses a call without the secret and does not count it", async () => {
      for (let i = 0; i < 25; i++) {
        const res = await unsigned(valid).expect(403);
        expect(res.body.detail).toBe(FORBIDDEN);
      }
      expect(await stored()).toEqual([]);
      for (let i = 0; i < 20; i++) await signup(valid).expect(204);
      expect(await stored()).toHaveLength(1);
    });

    it("answers 403 before validating the body", async () => {
      const res = await unsigned(
        { name: "x" },
        { "x-internal-secret": "wrong" },
      );
      expect(res.status).toBe(403);
      expect(res.body.detail).toBe(FORBIDDEN);
    });

    it("answers 403, not 429, to an unsigned call from a limited IP", async () => {
      for (let i = 0; i < 20; i++) await signup({ name: "x" }).expect(400);
      await signup(valid).expect(429);
      await unsigned(valid).expect(403);
    });

    it("answers 400 when the secret comes without a client IP, before validating", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/waitlist/signups")
        .set("x-internal-secret", INTERNAL_SECRET)
        .send({ name: "x" })
        .expect(400);
      expect(res.body.detail).toBe(NO_CLIENT_IP);
      expect(await stored()).toEqual([]);
    });

    it("stores nothing from a valid signup that comes without a client IP", async () => {
      const res = await request(ctx.app.getHttpServer())
        .post("/waitlist/signups")
        .set("x-internal-secret", INTERNAL_SECRET)
        .send(valid)
        .expect(400);
      expect(res.body.detail).toBe(NO_CLIENT_IP);
      expect(await stored()).toEqual([]);
    });
  });
});
