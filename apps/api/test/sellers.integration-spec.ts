import request from "supertest";
import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("seller profiles", () => {
  let ctx: TestContext;
  let admin: Admin;
  const base = () => `/stores/${admin.storeId}/sellers`;
  const client = () => as(ctx.app, admin.cookie);

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  it("stores WhatsApp numbers as international digits", async () => {
    const res = await client()
      .patch(`${base()}/${admin.sellerId}`)
      .send({ displayName: "Ana", whatsappNumber: "+55 (11) 99999-8888" })
      .expect(200);
    expect(res.body).toMatchObject({
      displayName: "Ana",
      whatsappNumber: "5511999998888",
      avatarUrl: null,
    });
    const [row] = await ctx.dataSource.query(
      `SELECT whatsapp_number FROM sellers WHERE id = $1`,
      [admin.sellerId],
    );
    expect(row.whatsapp_number).toBe("5511999998888");
  });

  it("rejects numbers without a country code and plain text", async () => {
    for (const whatsappNumber of [
      "11 99999-8888",
      "5511999998888",
      "ligar para Ana",
      "+12",
    ]) {
      const res = await client()
        .patch(`${base()}/${admin.sellerId}`)
        .send({ displayName: "Ana", whatsappNumber })
        .expect(400);
      expect(res.body.errors).toEqual([
        {
          pointer: "/whatsappNumber",
          detail:
            "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
        },
      ]);
    }
  });

  it("rejects unknown fields in the profile body", async () => {
    const res = await client()
      .patch(`${base()}/${admin.sellerId}`)
      .send({ displayName: "Ana", userId: admin.sellerId })
      .expect(400);
    expect(res.body.errors).toEqual([
      { pointer: "/userId", detail: "Campo não permitido." },
    ]);
  });

  it("rejects a profile id that is not a UUID at its route param", async () => {
    const invalidId = [{ pointer: "/params/id", detail: "Valor inválido." }];
    const update = await client()
      .patch(`${base()}/ana`)
      .send({ displayName: "Ana" })
      .expect(400);
    expect(update.body.errors).toEqual(invalidId);
    const avatar = await client()
      .post(`${base()}/ana/avatar`)
      .attach("file", await photo(), "a.jpg")
      .expect(400);
    expect(avatar.body.errors).toEqual(invalidId);
  });

  it("links public listings to the seller's updated number", async () => {
    const listing = await insertListing(ctx.dataSource, admin, {
      publication: "published",
    });
    await client()
      .patch(`${base()}/${admin.sellerId}`)
      .send({ whatsappNumber: "+55 21 97777-1234" })
      .expect(200);
    const res = await request(ctx.app.getHttpServer())
      .get(`/public/stores/loja-a/listings/${listing.slug}`)
      .expect(200);
    expect(res.body.sellers[0].whatsappNumber).toBe("5521977771234");
  });

  it("clears a number when an empty value is saved", async () => {
    const res = await client()
      .patch(`${base()}/${admin.sellerId}`)
      .send({ whatsappNumber: "" })
      .expect(200);
    expect(res.body.whatsappNumber).toBeNull();
  });

  it("lets a seller edit their own profile but no one else's", async () => {
    const seller = await addMember(ctx, admin, {
      email: "vendedora@example.com",
      name: "Vendedora",
      role: "seller",
    });
    const asSeller = as(ctx.app, seller.cookie);
    const own = await asSeller
      .patch(`${base()}/${seller.sellerId}`)
      .send({ displayName: "Vendedora Ana" })
      .expect(200);
    expect(own.body.displayName).toBe("Vendedora Ana");

    const other = await asSeller
      .patch(`${base()}/${admin.sellerId}`)
      .send({ displayName: "Trocado" })
      .expect(403);
    expect(other.body.detail).toBe("Você não tem permissão para esta ação.");
    const avatar = await asSeller
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("file", await photo(), "a.jpg")
      .expect(403);
    expect(avatar.body.detail).toBe("Você não tem permissão para esta ação.");
    await asSeller
      .post(`${base()}/${seller.sellerId}/avatar`)
      .attach("file", await photo(), "a.jpg")
      .expect(201);

    const [owner] = await ctx.dataSource.query(
      `SELECT display_name, avatar_key FROM sellers WHERE id = $1`,
      [admin.sellerId],
    );
    expect(owner).toEqual({ display_name: "Admin loja-a", avatar_key: null });
  });

  it("lets managers edit any member's profile", async () => {
    const seller = await addMember(ctx, admin, {
      email: "vendedora@example.com",
      name: "Vendedora",
      role: "seller",
    });
    const coAdmin = await addMember(ctx, admin, {
      email: "socia@example.com",
      name: "Sócia",
    });
    for (const manager of [admin, coAdmin]) {
      await as(ctx.app, manager.cookie)
        .patch(`${base()}/${seller.sellerId}`)
        .send({ whatsappNumber: "+55 21 97777-1234" })
        .expect(200);
    }
    await as(ctx.app, coAdmin.cookie)
      .post(`${base()}/${seller.sellerId}/avatar`)
      .attach("file", await photo(), "a.jpg")
      .expect(201);
  });

  it("shows every member's public profile to every role", async () => {
    const seller = await addMember(ctx, admin, {
      email: "vendedora@example.com",
      name: "Vendedora",
      role: "seller",
    });
    for (const cookie of [admin.cookie, seller.cookie]) {
      const res = await as(ctx.app, cookie).get(base()).expect(200);
      expect(res.body.items).toEqual([
        expect.objectContaining({
          id: admin.sellerId,
          displayName: "Admin loja-a",
          whatsappNumber: "5511999998888",
        }),
        expect.objectContaining({
          id: seller.sellerId,
          displayName: "Vendedora",
          whatsappNumber: null,
        }),
      ]);
    }
  });

  it("offers no way to create or delete a profile apart from its member", async () => {
    await client().post(base()).send({ displayName: "Avulso" }).expect(404);
    await client().delete(`${base()}/${admin.sellerId}`).expect(404);
    const [{ count }] = await ctx.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM sellers`,
    );
    expect(count).toBe(1);
  });

  it("replaces the avatar and stops serving the previous one", async () => {
    const first = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("file", await photo("#111"), "a.jpg")
      .expect(201);
    const second = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("file", await photo("#222"), "b.jpg")
      .expect(201);
    const server = ctx.app.getHttpServer();
    await request(server).get(second.body.avatarUrl).expect(200);
    await request(server).get(first.body.avatarUrl).expect(404);
  });

  it("asks for an image when an avatar upload carries none", async () => {
    const res = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .expect(400);
    expect(res.body.detail).toBe("Envie uma imagem.");
  });

  it("answers an avatar upload with more than one file in Portuguese", async () => {
    const res = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("file", await photo("#111"), "a.jpg")
      .attach("file", await photo("#222"), "b.jpg")
      .expect(400);
    expect(res.body.detail).toBe("Envie uma foto por vez.");
  });

  it("answers an avatar upload under another field name in Portuguese", async () => {
    const res = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("photo", await photo("#111"), "a.jpg")
      .expect(400);
    expect(res.body.detail).toBe("Envie uma foto por vez.");
  });

  it("refuses avatar uploads for another store's seller", async () => {
    const other = await createStoreWithAdmin(ctx, "loja-b");
    await as(ctx.app, other.cookie)
      .post(`/stores/${other.storeId}/sellers/${admin.sellerId}/avatar`)
      .attach("file", await photo(), "a.jpg")
      .expect(404);
    const list = await client().get(base()).expect(200);
    expect(list.body.items[0].avatarUrl).toBeNull();
  });

  it("hides sellers of other stores", async () => {
    const other = await createStoreWithAdmin(ctx, "loja-b");
    const intruder = as(ctx.app, other.cookie);
    await intruder.get(base()).expect(404);
    const unknown = await intruder
      .patch(`/stores/${other.storeId}/sellers/${admin.sellerId}`)
      .send({ displayName: "x" })
      .expect(404);
    expect(unknown.body.detail).toBe("Vendedor não encontrado.");
    const list = await client().get(base()).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        id: admin.sellerId,
        userId: expect.any(String),
        displayName: "Admin loja-a",
        whatsappNumber: "5511999998888",
      }),
    ]);
  });
});
