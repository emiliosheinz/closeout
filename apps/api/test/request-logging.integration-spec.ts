import { Controller, Get, Module, Res } from "@nestjs/common";
import type { Response } from "express";
import type { DestinationStream } from "pino";
import request from "supertest";
import {
  type Admin,
  as,
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  internalPost,
  PASSWORD,
  resetDatabase,
  type TestContext,
} from "./helpers";

const SENTINEL = "sentinel-5d1e88";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface LogLine {
  level: number;
  msg: string;
  reqId?: string;
  req?: { method?: string; path?: string };
  res?: { statusCode?: number };
  responseTime?: number;
}

@Controller("logging-probe")
class CookieController {
  @Get()
  setCookie(@Res({ passthrough: true }) res: Response) {
    res.setHeader("Set-Cookie", `closeout_session=${SENTINEL}; HttpOnly`);
    return { ok: true };
  }
}

@Module({ controllers: [CookieController] })
class CookieModule {}

describe("request logging", () => {
  let ctx: TestContext;
  let chunks: string[] = [];
  const logs: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };
  const raw = () => chunks.join("");
  const lines = (): LogLine[] =>
    raw()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  const completions = () => lines().filter((line) => line.res !== undefined);
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp([CookieModule], logs);
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    chunks = [];
  });
  afterAll(() => ctx.app.close());

  describe("request id", () => {
    it("echoes a valid incoming id", async () => {
      const id = `a-Z_9${"x".repeat(123)}`;
      const res = await request(server()).get("/nope").set("x-request-id", id);
      expect(res.headers["x-request-id"]).toBe(id);
    });

    it.each([
      ["missing", undefined],
      ["longer than 128 characters", "x".repeat(129)],
      ["with characters outside letters, digits, _ and -", "abc def"],
      ["with a dot", "abc.def"],
    ])("generates a new id when the incoming one is %s", async (_case, id) => {
      const req = request(server()).get("/nope");
      if (id !== undefined) req.set("x-request-id", id);
      const res = await req;
      expect(res.headers["x-request-id"]).toMatch(UUID);
    });

    it("tags every line written while handling the request", async () => {
      await createStoreWithAdmin(ctx, "loja-a");
      chunks = [];

      await request(server())
        .post("/auth/login")
        .set("x-internal-secret", INTERNAL_SECRET)
        .set("x-client-ip", "192.0.2.50")
        .set("x-request-id", "login-attempt-1")
        .send({ email: "loja-a@example.com", password: "wrong password" })
        .expect(401);

      const written = lines();
      expect(written.map((line) => line.msg)).toEqual(
        expect.arrayContaining([expect.stringContaining("Failed login")]),
      );
      expect(written.length).toBeGreaterThanOrEqual(2);
      for (const line of written) expect(line.reqId).toBe("login-attempt-1");
    });
  });

  describe("completion line", () => {
    it("records method, path without query, status and duration once", async () => {
      await request(server())
        .get(`/nope?q=${SENTINEL}`)
        .set("x-request-id", "probe-1")
        .expect(404);

      expect(completions()).toEqual([
        expect.objectContaining({
          reqId: "probe-1",
          req: expect.objectContaining({ method: "GET", path: "/nope" }),
          res: { statusCode: 404 },
          responseTime: expect.any(Number),
        }),
      ]);
      expect(raw()).not.toContain(SENTINEL);
    });

    it("is not written for health checks", async () => {
      await request(server()).get("/nope").expect(404);
      await request(server()).get("/health").expect(200);
      await request(server()).get("/health?probe=1").expect(200);

      const paths = completions().map((line) => line.req?.path);
      expect(paths).toEqual(["/nope"]);
    });

    it("is written with an id for a write refused by the origin check", async () => {
      const res = await request(server()).post("/auth/logout").expect(403);

      const id = res.headers["x-request-id"];
      expect(id).toMatch(UUID);
      expect(completions()).toEqual([
        expect.objectContaining({
          reqId: id,
          req: expect.objectContaining({
            method: "POST",
            path: "/auth/logout",
          }),
          res: { statusCode: 403 },
        }),
      ]);
    });

    it("is written with an id for a malformed JSON body", async () => {
      const res = await request(server())
        .post("/auth/login")
        .set("x-internal-secret", INTERNAL_SECRET)
        .set("x-client-ip", "192.0.2.51")
        .set("Content-Type", "application/json")
        .send(`{"email": "a@example.com", "password": "${SENTINEL}`)
        .expect(400);

      const id = res.headers["x-request-id"];
      expect(id).toMatch(UUID);
      expect(completions()).toEqual([
        expect.objectContaining({
          reqId: id,
          req: expect.objectContaining({ method: "POST", path: "/auth/login" }),
          res: { statusCode: 400 },
        }),
      ]);
      expect(raw()).not.toContain(SENTINEL);
    });
  });

  describe("credentials", () => {
    let owner: Admin;
    beforeEach(async () => {
      owner = await createStoreWithAdmin(ctx, "loja-a");
      chunks = [];
    });

    it("never logs credential headers or a set-cookie value", async () => {
      await request(server())
        .get("/me")
        .set("Cookie", `closeout_session=${SENTINEL}`)
        .set("Authorization", `Bearer ${SENTINEL}`)
        .set("x-internal-secret", SENTINEL)
        .expect(401);
      const probe = await request(server()).get("/logging-probe").expect(200);
      expect(probe.headers["set-cookie"]?.[0]).toContain(SENTINEL);

      expect(completions()).toHaveLength(2);
      expect(raw()).not.toContain(SENTINEL);
    });

    it("never logs a password, an invite token or link, or a session token", async () => {
      await request(server())
        .post("/auth/login")
        .set("x-internal-secret", INTERNAL_SECRET)
        .set("x-client-ip", "192.0.2.52")
        .send({ email: owner.email, password: SENTINEL })
        .expect(401);
      const signedIn = await request(server())
        .post("/auth/login")
        .set("x-internal-secret", INTERNAL_SECRET)
        .set("x-client-ip", "192.0.2.52")
        .send({ email: owner.email, password: PASSWORD })
        .expect(200);
      const issued = await as(ctx.app, owner.cookie)
        .post(`/stores/${owner.storeId}/invites`)
        .send({ email: "nova@example.com", role: "seller" })
        .expect(201);
      const token = issued.body.link.split("/invite/")[1];
      const accepted = await internalPost(
        ctx.app,
        "/auth/invites/accept",
        "192.0.2.53",
      )
        .send({ token, name: "Nova Pessoa", password: `${SENTINEL}-new` })
        .expect(200);
      await internalPost(ctx.app, "/auth/invites/lookup", "192.0.2.53")
        .send({ token: SENTINEL })
        .expect(404);

      expect(completions()).toHaveLength(5);
      expect(lines().some((line) => line.msg.includes("Failed login"))).toBe(
        true,
      );
      const written = raw();
      for (const secret of [
        SENTINEL,
        signedIn.body.sessionToken,
        accepted.body.sessionToken,
        issued.body.link,
        token,
      ]) {
        expect(secret).toEqual(expect.any(String));
        expect(written).not.toContain(secret);
      }
    });
  });
});
