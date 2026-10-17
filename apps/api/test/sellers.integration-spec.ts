import request from "supertest";
import {
  type Admin,
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
      .post(base())
      .send({ displayName: "Ana", whatsappNumber: "+55 (11) 99999-8888" })
      .expect(201);
    expect(res.body).toMatchObject({
      displayName: "Ana",
      whatsappNumber: "5511999998888",
      avatarUrl: null,
    });
  });

  it("rejects numbers without a country code and plain text", async () => {
    for (const whatsappNumber of [
      "11 99999-8888",
      "5511999998888",
      "ligar para Ana",
      "+12",
    ]) {
      const res = await client()
        .post(base())
        .send({ displayName: "Ana", whatsappNumber })
        .expect(400);
      expect(res.body.message.join(" ")).toMatch(/código do país/);
    }
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

  it("removes a deleted seller from listings they share and keeps the co-seller", async () => {
    const listing = await insertListing(ctx.dataSource, admin);
    const partner = await client()
      .post(base())
      .send({ displayName: "Bia", whatsappNumber: "+55 21 97777-1234" })
      .expect(201);
    await client()
      .patch(`/stores/${admin.storeId}/listings/${listing.id}`)
      .send({ sellerIds: [admin.sellerId, partner.body.id] })
      .expect(200);
    const counted = await client().get(base()).expect(200);
    expect(counted.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: partner.body.id, listingCount: 1 }),
      ]),
    );

    await client().delete(`${base()}/${partner.body.id}`).expect(204);

    const after = await client()
      .get(`/stores/${admin.storeId}/listings/${listing.id}`)
      .expect(200);
    expect(after.body.sellers).toEqual([
      { id: admin.sellerId, displayName: "Admin loja-a" },
    ]);
  });

  it("refuses to delete a seller who still has listings", async () => {
    await insertListing(ctx.dataSource, admin);
    await client().delete(`${base()}/${admin.sellerId}`).expect(409);
    const list = await client().get(base()).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({ id: admin.sellerId, listingCount: 1 }),
    ]);
  });

  it("deletes a seller without listings", async () => {
    const created = await client()
      .post(base())
      .send({ displayName: "Bia" })
      .expect(201);
    await client().delete(`${base()}/${created.body.id}`).expect(204);
    const list = await client().get(base()).expect(200);
    expect(list.body.items.map((s: { id: string }) => s.id)).toEqual([
      admin.sellerId,
    ]);
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

  it("answers an avatar upload with more than one file in Portuguese", async () => {
    const res = await client()
      .post(`${base()}/${admin.sellerId}/avatar`)
      .attach("file", await photo("#111"), "a.jpg")
      .attach("file", await photo("#222"), "b.jpg")
      .expect(400);
    expect(res.body.message).toBe("Envie uma foto por vez.");
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
    await intruder
      .patch(`/stores/${other.storeId}/sellers/${admin.sellerId}`)
      .send({ displayName: "x" })
      .expect(404);
    await intruder
      .delete(`/stores/${other.storeId}/sellers/${admin.sellerId}`)
      .expect(404);
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
