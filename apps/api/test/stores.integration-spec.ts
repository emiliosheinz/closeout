import request from "supertest";
import {
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("store administration", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDatabase(ctx.dataSource));
  afterAll(() => ctx.app.close());

  it("lists the admin's memberships on /me without exposing the password hash", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    const res = await as(ctx.app, admin.cookie).get("/me").expect(200);
    expect(res.body.user.email).toBe("loja-a@example.com");
    expect(res.body.memberships).toEqual([
      expect.objectContaining({
        role: "owner",
        store: expect.objectContaining({ id: admin.storeId, slug: "loja-a" }),
      }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain("scrypt");
  });

  it("creates every store with the default categories in order", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    const res = await as(ctx.app, admin.cookie)
      .get(`/stores/${admin.storeId}/categories`)
      .expect(200);
    expect(res.body.items.map((c: { name: string }) => c.name)).toEqual([
      "Móveis",
      "Eletrônicos",
      "Eletrodomésticos",
      "Cozinha",
      "Casa e decoração",
      "Esporte e lazer",
      "Livros e mídia",
      "Roupas e acessórios",
      "Outros",
    ]);
  });

  it("counts availability over published listings only", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    await insertListing(ctx.dataSource, admin, { publication: "draft" });
    await insertListing(ctx.dataSource, admin, { publication: "draft" });
    await insertListing(ctx.dataSource, admin, {
      publication: "published",
      availability: "available",
    });
    await insertListing(ctx.dataSource, admin, {
      publication: "published",
      availability: "reserved",
    });
    await insertListing(ctx.dataSource, admin, {
      publication: "published",
      availability: "sold",
    });
    await insertListing(ctx.dataSource, admin, { publication: "archived" });

    const res = await as(ctx.app, admin.cookie)
      .get(`/stores/${admin.storeId}/dashboard`)
      .expect(200);
    expect(res.body).toEqual({
      published: 3,
      available: 1,
      reserved: 1,
      sold: 1,
      draft: 2,
      archived: 1,
    });
  });

  it("updates the store identity", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    const res = await as(ctx.app, admin.cookie)
      .patch(`/stores/${admin.storeId}`)
      .send({
        name: "  Desapego da Casa  ",
        headline: "Tudo precisa ir",
        intro: "Mudamos em março.",
      })
      .expect(200);
    const expected = {
      name: "Desapego da Casa",
      headline: "Tudo precisa ir",
      intro: "Mudamos em março.",
    };
    expect(res.body).toMatchObject(expected);
    const publicStore = await request(ctx.app.getHttpServer())
      .get("/public/stores/loja-a")
      .expect(200);
    expect(publicStore.body).toMatchObject(expected);
  });

  it("answers 404 to members of another store and changes nothing", async () => {
    const a = await createStoreWithAdmin(ctx, "loja-a");
    const b = await createStoreWithAdmin(ctx, "loja-b");
    const intruder = as(ctx.app, a.cookie);
    await intruder.get(`/stores/${b.storeId}`).expect(404);
    await intruder.get(`/stores/${b.storeId}/dashboard`).expect(404);
    await intruder
      .patch(`/stores/${b.storeId}`)
      .send({ name: "Hacked" })
      .expect(404);
    await intruder.get(`/stores/not-a-uuid/dashboard`).expect(404);
    const [store] = await ctx.dataSource.query(
      `SELECT name FROM stores WHERE id = $1`,
      [b.storeId],
    );
    expect(store.name).toBe("Loja loja-b");
  });

  it("rejects unknown fields in the settings body", async () => {
    const admin = await createStoreWithAdmin(ctx, "loja-a");
    await as(ctx.app, admin.cookie)
      .patch(`/stores/${admin.storeId}`)
      .send({ slug: "taken-over" })
      .expect(400);
  });
});
