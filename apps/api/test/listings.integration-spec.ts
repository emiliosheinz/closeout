import { readdir } from "node:fs/promises";
import sharp from "sharp";
import request from "supertest";
import {
  type Admin,
  as,
  createStoreWithAdmin,
  createTestApp,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("listing administration", () => {
  let ctx: TestContext;
  let admin: Admin;
  const client = () => as(ctx.app, admin.cookie);
  const base = () => `/stores/${admin.storeId}/listings`;

  const createListing = async (fields: Record<string, unknown> = {}) => {
    const res = await client()
      .post(base())
      .send({
        title: "Mesa de jantar",
        categoryId: admin.categoryId,
        sellerIds: [admin.sellerId],
        condition: "good",
        ...fields,
      })
      .expect(201);
    return res.body;
  };

  const upload = (listingId: string, files: Buffer[]) => {
    const req = client().post(`${base()}/${listingId}/images`);
    for (const [i, file] of files.entries()) {
      req.attach("files", file, `foto-${i}.jpg`);
    }
    return req;
  };

  const mediaFileCount = async () =>
    (await readdir(process.env.MEDIA_DIR ?? "")).length;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  describe("lifecycle", () => {
    it("creates a draft, available listing with no price from the minimal fields", async () => {
      const listing = await createListing();
      expect(listing).toMatchObject({
        title: "Mesa de jantar",
        publication: "draft",
        availability: "available",
        priceCents: null,
        attributes: [],
        imageCount: 0,
      });
      expect(listing.slug).toMatch(/^mesa-de-jantar-[a-z0-9]{6}$/);
    });

    it("keeps optional price and attributes", async () => {
      const listing = await createListing({
        priceCents: 45000,
        attributes: [{ label: "Material", value: "Madeira" }],
      });
      expect(listing.priceCents).toBe(45000);
      expect(listing.attributes).toEqual([
        { label: "Material", value: "Madeira" },
      ]);
    });

    it("keeps the slug when the title changes", async () => {
      const listing = await createListing();
      const updated = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ title: "Mesa redonda" })
        .expect(200);
      expect(updated.body.title).toBe("Mesa redonda");
      expect(updated.body.slug).toBe(listing.slug);
    });

    it("clears the price when null is sent", async () => {
      const listing = await createListing({ priceCents: 1000 });
      const updated = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ priceCents: null })
        .expect(200);
      expect(updated.body.priceCents).toBeNull();
    });

    it("refuses to publish a listing without photos", async () => {
      const listing = await createListing();
      const res = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "published" })
        .expect(422);
      expect(res.body.message).toBe(
        "Adicione ao menos uma foto antes de publicar.",
      );
    });

    it("publishes, archives and changes availability independently", async () => {
      const listing = await createListing();
      await upload(listing.id, [await photo()]).expect(201);

      const published = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "published" })
        .expect(200);
      expect(published.body).toMatchObject({
        publication: "published",
        availability: "available",
      });

      const reserved = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ availability: "reserved" })
        .expect(200);
      expect(reserved.body).toMatchObject({
        publication: "published",
        availability: "reserved",
      });

      const archived = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "archived" })
        .expect(200);
      expect(archived.body).toMatchObject({
        publication: "archived",
        availability: "reserved",
      });

      const draft = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "draft" })
        .expect(200);
      expect(draft.body.publication).toBe("draft");
    });

    it("rejects invalid enum values and unknown fields", async () => {
      const listing = await createListing();
      await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ availability: "gone" })
        .expect(400);
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ storeId: "00000000-0000-0000-0000-000000000000" })
        .expect(400);
      await client().post(base()).send({ title: "" }).expect(400);
      await client()
        .post(base())
        .send({
          title: "x",
          categoryId: admin.categoryId,
          sellerIds: [admin.sellerId],
          condition: "good",
          priceCents: -1,
        })
        .expect(400);
    });

    it("sells one listing through several sellers, listed by name", async () => {
      const partner = await client()
        .post(`/stores/${admin.storeId}/sellers`)
        .send({ displayName: "Bia", whatsappNumber: "+55 21 97777-1234" })
        .expect(201);
      const listing = await createListing({
        sellerIds: [admin.sellerId, partner.body.id],
      });
      expect(listing.sellers).toEqual([
        { id: admin.sellerId, displayName: "Admin loja-a" },
        { id: partner.body.id, displayName: "Bia" },
      ]);

      const updated = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ sellerIds: [partner.body.id] })
        .expect(200);
      expect(updated.body.sellers).toEqual([
        { id: partner.body.id, displayName: "Bia" },
      ]);

      await upload(listing.id, [await photo()]).expect(201);
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({
          sellerIds: [partner.body.id, admin.sellerId],
          publication: "published",
        })
        .expect(200);
      const page = await request(ctx.app.getHttpServer())
        .get(`/public/stores/loja-a/listings/${listing.slug}`)
        .expect(200);
      expect(page.body).toMatchObject({
        canContact: true,
        sellers: [
          { name: "Admin loja-a", whatsappNumber: "5511999998888" },
          { name: "Bia", whatsappNumber: "5521977771234" },
        ],
      });
    });

    it("requires at least one seller and no repeats", async () => {
      await client()
        .post(base())
        .send({
          title: "Mesa",
          categoryId: admin.categoryId,
          sellerIds: [],
          condition: "good",
        })
        .expect(400);
      const listing = await createListing();
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ sellerIds: [admin.sellerId, admin.sellerId] })
        .expect(400);
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ sellerIds: [] })
        .expect(400);
      const unchanged = await client().get(`${base()}/${listing.id}`);
      expect(unchanged.body.sellers).toEqual([
        { id: admin.sellerId, displayName: "Admin loja-a" },
      ]);
    });

    it("duplicates into a new draft without photos", async () => {
      const listing = await createListing({
        priceCents: 500,
        description: "Seis lugares",
        condition: "like_new",
        attributes: [{ label: "Material", value: "Madeira" }],
      });
      await upload(listing.id, [await photo()]).expect(201);
      await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "published", availability: "reserved" })
        .expect(200);
      const copy = await client()
        .post(`${base()}/${listing.id}/duplicate`)
        .expect(201);
      expect(copy.body).toMatchObject({
        title: "Mesa de jantar (cópia)",
        description: "Seis lugares",
        condition: "like_new",
        attributes: [{ label: "Material", value: "Madeira" }],
        category: { id: admin.categoryId },
        sellers: [{ id: admin.sellerId }],
        publication: "draft",
        availability: "available",
        priceCents: 500,
        imageCount: 0,
      });
      expect(copy.body.id).not.toBe(listing.id);
      expect(copy.body.slug).not.toBe(listing.slug);
    });

    it("deletes a listing together with its stored photos", async () => {
      const listing = await createListing();
      const uploaded = await upload(listing.id, [await photo()]).expect(201);
      const imageUrl = uploaded.body.items[0].urls.lg;
      await request(ctx.app.getHttpServer()).get(imageUrl).expect(200);

      await client().delete(`${base()}/${listing.id}`).expect(204);

      await client().get(`${base()}/${listing.id}`).expect(404);
      await request(ctx.app.getHttpServer()).get(imageUrl).expect(404);
    });

    it("removes a deleted published listing from its public URL", async () => {
      const listing = await createListing();
      await upload(listing.id, [await photo()]).expect(201);
      await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "published" })
        .expect(200);
      const publicUrl = `/public/stores/loja-a/listings/${listing.slug}`;
      await request(ctx.app.getHttpServer()).get(publicUrl).expect(200);
      await client().delete(`${base()}/${listing.id}`).expect(204);
      await request(ctx.app.getHttpServer()).get(publicUrl).expect(404);
    });

    it("reflects an availability change on the public page right away", async () => {
      const listing = await createListing();
      await upload(listing.id, [await photo()]).expect(201);
      const status = (body: object) =>
        client().patch(`${base()}/${listing.id}/status`).send(body).expect(200);
      await status({ publication: "published" });
      const publicUrl = `/public/stores/loja-a/listings/${listing.slug}`;
      const server = ctx.app.getHttpServer();

      await status({ availability: "reserved" });
      expect(
        (await request(server).get(publicUrl).expect(200)).body,
      ).toMatchObject({
        availability: "reserved",
        canContact: true,
      });

      await status({ availability: "sold" });
      expect(
        (await request(server).get(publicUrl).expect(200)).body,
      ).toMatchObject({
        availability: "sold",
        canContact: false,
        sellers: [{ whatsappNumber: null }],
      });
    });

    it("filters the admin table by title, ignoring accents and case", async () => {
      await createListing({ title: "Sofá retrátil" });
      await createListing({ title: "Geladeira" });
      const res = await client().get(`${base()}?q=SOFA`).expect(200);
      expect(res.body.items.map((l: { title: string }) => l.title)).toEqual([
        "Sofá retrátil",
      ]);
    });

    it("refuses previews without a session", async () => {
      const listing = await createListing({ description: "Segredo" });
      const res = await request(ctx.app.getHttpServer())
        .get(`${base()}/${listing.id}/preview`)
        .expect(401);
      expect(JSON.stringify(res.body)).not.toContain("Segredo");
    });

    it("renders a preview of a draft", async () => {
      const listing = await createListing({ description: "Seis lugares" });
      const res = await client()
        .get(`${base()}/${listing.id}/preview`)
        .expect(200);
      expect(res.body).toMatchObject({
        title: "Mesa de jantar",
        description: "Seis lugares",
        sellers: [{ name: "Admin loja-a", whatsappNumber: "5511999998888" }],
      });
    });
  });

  describe("store boundaries", () => {
    it("rejects a seller or category from another store and creates nothing", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      await client()
        .post(base())
        .send({
          title: "Mesa",
          categoryId: admin.categoryId,
          sellerIds: [other.sellerId],
          condition: "good",
        })
        .expect(422);
      await client()
        .post(base())
        .send({
          title: "Mesa",
          categoryId: other.categoryId,
          sellerIds: [admin.sellerId],
          condition: "good",
        })
        .expect(422);
      const listing = await createListing();
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ sellerIds: [other.sellerId], title: "Trocado" })
        .expect(422);
      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ categoryId: other.categoryId, title: "Trocado" })
        .expect(422);
      const unchanged = await client()
        .get(`${base()}/${listing.id}`)
        .expect(200);
      expect(unchanged.body).toMatchObject({
        title: "Mesa de jantar",
        sellers: [{ id: admin.sellerId }],
        category: { id: admin.categoryId },
      });
      const [{ count }] = await ctx.dataSource.query(
        `SELECT COUNT(*)::int AS count FROM listings`,
      );
      expect(count).toBe(1);
    });

    it("hides another store's listing from its own path and from the intruder's", async () => {
      const listing = await createListing();
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const intruder = as(ctx.app, other.cookie);

      await intruder.get(`${base()}/${listing.id}`).expect(404);
      await intruder
        .patch(`${base()}/${listing.id}`)
        .send({ title: "x" })
        .expect(404);
      await intruder.delete(`${base()}/${listing.id}`).expect(404);
      await intruder
        .post(`${base()}/${listing.id}/images`)
        .attach("files", await photo(), "a.jpg")
        .expect(404);

      const ownStore = `/stores/${other.storeId}/listings/${listing.id}`;
      await intruder.get(ownStore).expect(404);
      await intruder.patch(ownStore).send({ title: "x" }).expect(404);
      await intruder.delete(ownStore).expect(404);

      const unchanged = await client()
        .get(`${base()}/${listing.id}`)
        .expect(200);
      expect(unchanged.body.title).toBe("Mesa de jantar");
    });

    it("refuses to reorder or delete another store's photos", async () => {
      const listing = await createListing();
      const uploaded = await upload(listing.id, [
        await photo("#111"),
        await photo("#222"),
      ]).expect(201);
      const ids = uploaded.body.items.map((i: { id: string }) => i.id);
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const intruder = as(ctx.app, other.cookie);
      const ownStore = `/stores/${other.storeId}/listings/${listing.id}`;

      await intruder
        .put(`${base()}/${listing.id}/images/order`)
        .send({ ids: [ids[1], ids[0]] })
        .expect(404);
      await intruder
        .delete(`${base()}/${listing.id}/images/${ids[0]}`)
        .expect(404);
      await intruder
        .put(`${ownStore}/images/order`)
        .send({ ids: [ids[1], ids[0]] })
        .expect(404);
      await intruder.delete(`${ownStore}/images/${ids[0]}`).expect(404);

      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.images.map((i: { id: string }) => i.id)).toEqual(ids);
      await request(ctx.app.getHttpServer())
        .get(uploaded.body.items[0].urls.lg)
        .expect(200);
    });
  });

  describe("photos", () => {
    it("stores several uploads and serves cacheable variants", async () => {
      const listing = await createListing();
      const png = await sharp({
        create: { width: 400, height: 300, channels: 4, background: "#3a6" },
      })
        .png()
        .toBuffer();
      const res = await upload(listing.id, [await photo(), png]).expect(201);
      expect(res.body.items).toHaveLength(2);
      expect(
        res.body.items.map((i: { position: number }) => i.position),
      ).toEqual([0, 1]);

      const [first] = res.body.items;
      const server = ctx.app.getHttpServer();
      const lg = await request(server).get(first.urls.lg).expect(200);
      expect(lg.headers["content-type"]).toBe("image/webp");
      expect(lg.headers["cache-control"]).toContain("immutable");
      const og = await request(server)
        .get(first.urls.lg.replace("-lg.webp", "-og.jpg"))
        .expect(200);
      const ogMeta = await sharp(og.body).metadata();
      expect([ogMeta.format, ogMeta.width, ogMeta.height]).toEqual([
        "jpeg",
        1200,
        630,
      ]);
    });

    it("strips EXIF metadata such as GPS from stored photos", async () => {
      const listing = await createListing();
      const withExif = await sharp({
        create: { width: 200, height: 200, channels: 3, background: "#888" },
      })
        .withExif({ IFD0: { Copyright: "secret-owner" } })
        .jpeg()
        .toBuffer();
      const res = await upload(listing.id, [withExif]).expect(201);
      const stored = await request(ctx.app.getHttpServer())
        .get(res.body.items[0].urls.lg)
        .expect(200);
      expect((await sharp(stored.body).metadata()).exif).toBeUndefined();
    });

    it("rejects a non-image renamed .jpg and persists nothing", async () => {
      const listing = await createListing();
      const before = await mediaFileCount();
      const res = await upload(listing.id, [
        await photo(),
        Buffer.from("definitely not an image"),
      ]).expect(400);
      expect(res.body.message).toBe("Arquivo não é uma imagem válida.");
      expect(await mediaFileCount()).toBe(before);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.imageCount).toBe(0);
    });

    it("rejects files over 10 MB with 413 and persists nothing", async () => {
      const listing = await createListing();
      const before = await mediaFileCount();
      const res = await upload(listing.id, [
        Buffer.alloc(10 * 1024 * 1024 + 1),
      ]).expect(413);
      expect(res.body.message).toBe("Cada foto pode ter até 10 MB.");
      expect(await mediaFileCount()).toBe(before);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.imageCount).toBe(0);
    });

    it("rejects more than 8 files per request", async () => {
      const listing = await createListing();
      const small = await photo("#123", 32, 32);
      const res = await upload(listing.id, Array(9).fill(small)).expect(400);
      expect(res.body.message).toBe("Envie até 8 fotos por vez.");
    });

    it("rejects images above 40 megapixels before decoding them", async () => {
      const listing = await createListing();
      const bomb = await sharp({
        create: { width: 8000, height: 6000, channels: 3, background: "#fff" },
      })
        .png({ compressionLevel: 9 })
        .toBuffer();
      expect(bomb.length).toBeLessThan(10 * 1024 * 1024);
      const before = await mediaFileCount();
      await upload(listing.id, [await photo(), bomb]).expect(400);
      expect(await mediaFileCount()).toBe(before);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.imageCount).toBe(0);
    });

    it("caps a listing at 20 photos", async () => {
      const listing = await createListing();
      const small = await photo("#123", 64, 64);
      for (const count of [8, 8, 4]) {
        await upload(listing.id, Array(count).fill(small)).expect(201);
      }
      await upload(listing.id, [small]).expect(422);
    });

    it("reorders photos only when given exactly the listing's photo ids", async () => {
      const listing = await createListing();
      const res = await upload(listing.id, [
        await photo("#111"),
        await photo("#222"),
        await photo("#333"),
      ]).expect(201);
      const ids: string[] = res.body.items.map((i: { id: string }) => i.id);

      const reordered = await client()
        .put(`${base()}/${listing.id}/images/order`)
        .send({ ids: [ids[2], ids[0], ids[1]] })
        .expect(200);
      expect(reordered.body.items.map((i: { id: string }) => i.id)).toEqual([
        ids[2],
        ids[0],
        ids[1],
      ]);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.coverUrl).toBe(reordered.body.items[0].urls.sm);

      await client()
        .put(`${base()}/${listing.id}/images/order`)
        .send({ ids: [ids[0], ids[1]] })
        .expect(422);
      await client()
        .put(`${base()}/${listing.id}/images/order`)
        .send({ ids: [ids[0], ids[0], ids[1]] })
        .expect(422);
    });

    it("deletes a photo, renumbers the rest and stops serving its files", async () => {
      const listing = await createListing();
      const res = await upload(listing.id, [
        await photo("#111"),
        await photo("#222"),
      ]).expect(201);
      const [first, second] = res.body.items;

      const after = await client()
        .delete(`${base()}/${listing.id}/images/${first.id}`)
        .expect(200);
      expect(after.body.items).toEqual([
        expect.objectContaining({ id: second.id, position: 0 }),
      ]);
      await request(ctx.app.getHttpServer()).get(first.urls.lg).expect(404);
    });

    it("refuses to delete the last photo of a published listing", async () => {
      const listing = await createListing();
      const res = await upload(listing.id, [await photo()]).expect(201);
      await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "published" })
        .expect(200);
      await client()
        .delete(`${base()}/${listing.id}/images/${res.body.items[0].id}`)
        .expect(422);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);
      expect(detail.body.imageCount).toBe(1);
    });

    it("keeps the immutable cache header on media and no-store on admin JSON", async () => {
      const listing = await createListing();
      const res = await upload(listing.id, [await photo()]).expect(201);
      expect(res.headers["cache-control"]).toBe("no-store");
      const media = await request(ctx.app.getHttpServer())
        .get(res.body.items[0].urls.lg)
        .expect(200);
      expect(media.headers["cache-control"]).toBe(
        "public, max-age=31536000, immutable",
      );
    });

    it("rejects a non-file form field on upload in Portuguese", async () => {
      const listing = await createListing();
      const res = await client()
        .post(`${base()}/${listing.id}/images`)
        .field("alt", "texto")
        .attach("files", await photo(), "a.jpg")
        .expect(400);
      expect(res.body.message).toBe("Envie apenas fotos, sem outros campos.");
    });

    it("never serves files outside the media naming scheme", async () => {
      const server = ctx.app.getHttpServer();
      await request(server).get("/media/..%2F..%2Fetc%2Fpasswd").expect(404);
      await request(server).get("/media/.env").expect(404);
      await request(server)
        .get("/media/00000000-0000-0000-0000-000000000000-lg.webp")
        .expect(404);
    });
  });
});
