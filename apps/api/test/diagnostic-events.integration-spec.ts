import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { DestinationStream } from "pino";
import request from "supertest";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  INTERNAL_SECRET,
  internalPost,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

const SENTINEL = "sentinel-c41b07";

type LogLine = Record<string, unknown> & { msg: string; reqId?: string };

describe("diagnostic events", () => {
  let ctx: TestContext;
  let owner: Admin;
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
  /** The one line with `msg`, tagged with the id of the response it was logged for. */
  const event = (msg: string, res: request.Response) => {
    const matching = lines().filter((line) => line.msg === msg);
    expect(matching).toHaveLength(1);
    const reqId = res.headers["x-request-id"];
    expect(reqId).toEqual(expect.any(String));
    expect(matching[0]?.reqId).toBe(reqId);
    return matching[0];
  };
  // A fresh client IP per test: the limiters live as long as the app.
  let ip = "";
  let ipCount = 0;
  const server = () => ctx.app.getHttpServer();
  const asOwner = () => as(ctx.app, owner.cookie);
  const ownerId = async (): Promise<string> => {
    const [user] = await ctx.dataSource.query(
      `SELECT id FROM users WHERE email = $1`,
      [owner.email],
    );
    return user.id;
  };
  const invites = () => `/stores/${owner.storeId}/invites`;
  const login = (password: string) =>
    request(server())
      .post("/auth/login")
      .set("x-internal-secret", INTERNAL_SECRET)
      .set("x-client-ip", ip)
      .send({ email: owner.email, password });
  const issueInvite = async () => {
    const res = await asOwner()
      .post(invites())
      .send({ email: "nova@example.com", role: "seller" })
      .expect(201);
    return {
      id: res.body.invite.id as string,
      token: res.body.link.split("/invite/")[1] as string,
      res,
    };
  };

  beforeAll(async () => {
    ctx = await createTestApp([], logs);
  });
  beforeEach(async () => {
    ipCount += 1;
    ip = `198.51.100.${ipCount}`;
    await resetDatabase(ctx.dataSource);
    owner = await createStoreWithAdmin(ctx, "loja-a");
    chunks = [];
  });
  afterAll(() => ctx.app.close());

  it("logs a failed login with the client IP", async () => {
    const res = await login("wrong password").expect(401);

    expect(event("Failed login", res)).toMatchObject({
      ip,
    });
  });

  it("logs a rate-limited login with the client IP", async () => {
    for (let i = 0; i < 10; i++) await login("wrong password").expect(401);
    const res = await login("wrong password").expect(429);

    expect(event("Login rate limited", res)).toMatchObject({
      ip,
    });
  });

  it("logs an issued invite with its id, email, role, store and inviter", async () => {
    const issued = await issueInvite();

    expect(event("Invite created", issued.res)).toMatchObject({
      inviteId: issued.id,
      email: "nova@example.com",
      storeId: owner.storeId,
      role: "seller",
      actorId: await ownerId(),
    });
  });

  it("logs a regenerated invite with its id, email, store and actor", async () => {
    const issued = await issueInvite();
    const res = await asOwner()
      .post(`${invites()}/${issued.id}/regenerate`)
      .expect(200);

    expect(event("Invite regenerated", res)).toMatchObject({
      inviteId: issued.id,
      email: "nova@example.com",
      storeId: owner.storeId,
      actorId: await ownerId(),
    });
  });

  it("logs a revoked invite with its id, email, store and actor", async () => {
    const issued = await issueInvite();
    const res = await asOwner().delete(`${invites()}/${issued.id}`).expect(204);

    expect(event("Invite revoked", res)).toMatchObject({
      inviteId: issued.id,
      email: "nova@example.com",
      storeId: owner.storeId,
      actorId: await ownerId(),
    });
  });

  it("logs an accepted invite with the new member and store", async () => {
    const issued = await issueInvite();
    const res = await internalPost(ctx.app, "/auth/invites/accept", ip)
      .send({
        token: issued.token,
        name: "Nova Pessoa",
        password: "new pass 1234",
      })
      .expect(200);

    const [user] = await ctx.dataSource.query(
      `SELECT id FROM users WHERE email = 'nova@example.com'`,
    );
    expect(event("Invite accepted", res)).toMatchObject({
      userId: user.id,
      storeId: owner.storeId,
      role: "seller",
    });
  });

  it("logs rate-limited invite attempts with the client IP", async () => {
    for (let i = 0; i < 10; i++) {
      await internalPost(ctx.app, "/auth/invites/lookup", ip)
        .send({ token: `not-a-token-${i}` })
        .expect(404);
    }
    const res = await internalPost(ctx.app, "/auth/invites/lookup", ip)
      .send({ token: "not-a-token" })
      .expect(429);

    expect(event("Invite attempts rate limited", res)).toMatchObject({
      ip,
    });
  });

  it("logs a session that could not be minted after an accept, without the database message", async () => {
    const issued = await issueInvite();
    await ctx.dataSource.query(`
      CREATE FUNCTION refuse_session() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'refused %', '${SENTINEL}'; END $$;
      CREATE TRIGGER refuse_session BEFORE INSERT ON sessions
        FOR EACH ROW EXECUTE FUNCTION refuse_session();
    `);
    try {
      const res = await internalPost(ctx.app, "/auth/invites/accept", ip)
        .send({
          token: issued.token,
          name: "Nova Pessoa",
          password: "new pass 1234",
        })
        .expect(500);

      const [user] = await ctx.dataSource.query(
        `SELECT id FROM users WHERE email = 'nova@example.com'`,
      );
      expect(event("Session mint failed", res)).toMatchObject({
        userId: user.id,
        err: expect.objectContaining({ code: "P0001" }),
      });
      expect(chunks.join("")).not.toContain(SENTINEL);
    } finally {
      await ctx.dataSource.query(`
        DROP TRIGGER refuse_session ON sessions;
        DROP FUNCTION refuse_session();
      `);
    }
  });

  it("logs a member role change with the member, email, store and actor", async () => {
    const member = await addMember(ctx, owner, {
      email: "vendedor@example.com",
      name: "Vendedor",
      role: "seller",
    });
    chunks = [];
    const res = await asOwner()
      .patch(`/stores/${owner.storeId}/members/${member.userId}`)
      .send({ role: "admin" })
      .expect(200);

    expect(event("Member role changed", res)).toMatchObject({
      memberId: member.userId,
      email: "vendedor@example.com",
      storeId: owner.storeId,
      fromRole: "seller",
      toRole: "admin",
      actorId: await ownerId(),
    });
  });

  it("logs a member removal with the member, email, store and actor", async () => {
    const member = await addMember(ctx, owner, {
      email: "vendedor@example.com",
      name: "Vendedor",
      role: "seller",
    });
    chunks = [];
    const res = await asOwner()
      .delete(`/stores/${owner.storeId}/members/${member.userId}`)
      .expect(204);

    expect(event("Member removed", res)).toMatchObject({
      memberId: member.userId,
      email: "vendedor@example.com",
      storeId: owner.storeId,
      actorId: await ownerId(),
    });
  });

  it("logs a media file that could not be removed with its name", async () => {
    const listing = await asOwner()
      .post(`/stores/${owner.storeId}/listings`)
      .send({
        title: "Mesa",
        categoryId: owner.categoryId,
        sellerIds: [owner.sellerId],
        condition: "good",
      })
      .expect(201);
    const images = `/stores/${owner.storeId}/listings/${listing.body.id}/images`;
    const uploaded = await asOwner()
      .post(images)
      .attach("files", await photo(), "a.jpg")
      .expect(201);
    const [image] = await ctx.dataSource.query(
      `SELECT storage_key AS key FROM listing_images WHERE listing_id = $1`,
      [listing.body.id],
    );
    // A directory where a variant file should be: removal fails even as root.
    const blocked = `${image.key}-sm.webp`;
    const target = path.join(process.env.MEDIA_DIR ?? "", blocked);
    await rm(target);
    await mkdir(path.join(target, "inside"), { recursive: true });
    try {
      chunks = [];
      const res = await asOwner()
        .delete(`${images}/${uploaded.body.items[0].id}`)
        .expect(200);

      expect(event("Failed to remove media file", res)).toMatchObject({
        file: blocked,
        err: expect.objectContaining({ type: expect.any(String) }),
      });
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });
});
