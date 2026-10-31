import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("sale info on listings", () => {
  let ctx: TestContext;
  let admin: Admin;
  const client = () => as(ctx.app, admin.cookie);
  const base = () => `/stores/${admin.storeId}/listings`;

  const insertBuyer = async (
    name: string,
    nameKey = name.toLowerCase(),
    storeId = admin.storeId,
  ): Promise<string> => {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO buyers (store_id, name, name_key) VALUES ($1, $2, $3) RETURNING id`,
      [storeId, name, nameKey],
    );
    return row.id;
  };

  const sellTo = (
    listingId: string,
    buyerId: string,
    sale: { price: number | null; paid: boolean; notes: string | null },
  ) =>
    ctx.dataSource.query(
      `UPDATE listings SET buyer_id = $2, agreed_price_cents = $3, paid = $4, sale_notes = $5 WHERE id = $1`,
      [listingId, buyerId, sale.price, sale.paid, sale.notes],
    );

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  describe("reading", () => {
    it("carries a null sale for available listings and legacy held listings without buyer", async () => {
      await insertListing(ctx.dataSource, admin);
      const legacy = await insertListing(ctx.dataSource, admin, {
        availability: "reserved",
      });

      const list = await client().get(base()).expect(200);
      const detail = await client().get(`${base()}/${legacy.id}`).expect(200);

      expect(list.body.items).toHaveLength(2);
      for (const item of list.body.items) expect(item.sale).toBeNull();
      expect(detail.body.sale).toBeNull();
    });

    it("carries the buyer, agreed price, paid and notes of a sold listing", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "sold",
      });
      const buyerId = await insertBuyer("Ana");
      await sellTo(listing.id, buyerId, {
        price: 7000,
        paid: true,
        notes: "retira sábado",
      });
      const expected = {
        buyer: { id: buyerId, name: "Ana" },
        agreedPriceCents: 7000,
        paid: true,
        notes: "retira sábado",
      };

      const list = await client().get(base()).expect(200);
      const detail = await client().get(`${base()}/${listing.id}`).expect(200);

      expect(list.body.items[0].sale).toEqual(expected);
      expect(detail.body.sale).toEqual(expected);
    });

    it("lets a legacy sold listing without buyer change publication and keep a null sale", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "sold",
        publication: "archived",
      });

      const res = await client()
        .patch(`${base()}/${listing.id}/status`)
        .send({ publication: "draft" })
        .expect(200);

      expect(res.body).toMatchObject({
        availability: "sold",
        publication: "draft",
        sale: null,
      });
    });
  });

  describe("changing status", () => {
    const setStatus = (id: string, body: object) =>
      client().patch(`${base()}/${id}/status`).send(body);

    const buyerRows = (): Promise<{ id: string; name: string }[]> =>
      ctx.dataSource.query(`SELECT id, name FROM buyers ORDER BY name`);

    const saleOf = async (id: string) => {
      const [row] = await ctx.dataSource.query(
        `SELECT buyer_id, agreed_price_cents, paid, sale_notes, availability FROM listings WHERE id = $1`,
        [id],
      );
      return row;
    };

    it("creates and links the buyer when reserving with a new name", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      const res = await setStatus(listing.id, {
        availability: "reserved",
        buyer: { name: "Maria Silva", whatsappNumber: "+55 11 98888-7777" },
        agreedPriceCents: 12500,
      }).expect(200);

      const [buyer] = await buyerRows();
      expect(buyer?.name).toBe("Maria Silva");
      expect(res.body.sale).toEqual({
        buyer: { id: buyer?.id, name: "Maria Silva" },
        agreedPriceCents: 12500,
        paid: false,
        notes: null,
      });
    });

    it("links the existing buyer when the name differs in case, accents and spacing", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const existing = await insertBuyer("Maria Silva", "maria silva");

      const res = await setStatus(listing.id, {
        availability: "sold",
        buyer: { name: " maria  sílva " },
      }).expect(200);

      expect(res.body.sale.buyer).toEqual({
        id: existing,
        name: "Maria Silva",
      });
      expect(await buyerRows()).toHaveLength(1);
    });

    it("links one buyer to two listings reserved concurrently under the same new name", async () => {
      const first = await insertListing(ctx.dataSource, admin);
      const second = await insertListing(ctx.dataSource, admin);

      await Promise.all(
        [first, second].map((listing) =>
          setStatus(listing.id, {
            availability: "reserved",
            buyer: { name: "Carlos" },
          }).expect(200),
        ),
      );

      const [buyer] = await buyerRows();
      expect(await buyerRows()).toHaveLength(1);
      expect((await saleOf(first.id)).buyer_id).toBe(buyer?.id);
      expect((await saleOf(second.id)).buyer_id).toBe(buyer?.id);
    });

    it("answers 400 and stores nothing when the notes are too long", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      await setStatus(listing.id, {
        availability: "reserved",
        buyer: { name: "Zé" },
        notes: "x".repeat(1001),
      }).expect(400);

      expect(await buyerRows()).toEqual([]);
      expect((await saleOf(listing.id)).availability).toBe("available");
    });

    it("answers 409 and changes nothing for a buyer id that is unknown or from another store", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const foreign = await insertBuyer("Outra", "outra", other.storeId);

      for (const id of [crypto.randomUUID(), foreign]) {
        await setStatus(listing.id, {
          availability: "reserved",
          buyer: { id },
        }).expect(409);
      }

      expect((await saleOf(listing.id)).availability).toBe("available");
    });

    it("answers 409 for a buyer deleted before the request", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const id = await insertBuyer("Ana");
      await ctx.dataSource.query(`DELETE FROM buyers WHERE id = $1`, [id]);

      await setStatus(listing.id, {
        availability: "reserved",
        buyer: { id },
      }).expect(409);

      expect((await saleOf(listing.id)).availability).toBe("available");
    });

    it("answers 409 when entering a state the listing is already in with a different buyer", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const ana = await insertBuyer("Ana");
      const bia = await insertBuyer("Bia");
      await setStatus(listing.id, {
        availability: "reserved",
        buyer: { id: ana },
      }).expect(200);

      const res = await setStatus(listing.id, {
        availability: "reserved",
        buyer: { id: bia },
      }).expect(409);

      expect(res.body.detail).toBe("O anúncio mudou. Recarregue a página.");
      expect((await saleOf(listing.id)).buyer_id).toBe(ana);
    });

    it("accepts repeating reserved without a buyer and keeps the sale", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const ana = await insertBuyer("Ana");
      await setStatus(listing.id, {
        availability: "reserved",
        buyer: { id: ana },
        agreedPriceCents: 500,
      }).expect(200);

      await setStatus(listing.id, { availability: "reserved" }).expect(200);

      expect(await saleOf(listing.id)).toMatchObject({
        buyer_id: ana,
        agreed_price_cents: 500,
      });
    });

    it("keeps the sale when moving from sold to reserved without a buyer", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "sold",
      });
      const ana = await insertBuyer("Ana");
      await sellTo(listing.id, ana, { price: 7000, paid: true, notes: "x" });

      await setStatus(listing.id, { availability: "reserved" }).expect(200);

      expect(await saleOf(listing.id)).toMatchObject({
        buyer_id: ana,
        agreed_price_cents: 7000,
        paid: true,
        sale_notes: "x",
        availability: "reserved",
      });
    });

    it("clears the sale and keeps the buyer when releasing to available", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "reserved",
      });
      const ana = await insertBuyer("Ana");
      await sellTo(listing.id, ana, { price: 7000, paid: true, notes: "x" });

      const res = await setStatus(listing.id, {
        availability: "available",
      }).expect(200);

      expect(res.body.sale).toBeNull();
      expect(await saleOf(listing.id)).toMatchObject({
        buyer_id: null,
        agreed_price_cents: null,
        paid: false,
        sale_notes: null,
      });
      expect(await buyerRows()).toHaveLength(1);
    });

    it("answers 400 for sale fields without a buyer or on a return to available", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      await setStatus(listing.id, {
        availability: "reserved",
        paid: true,
      }).expect(400);
      await setStatus(listing.id, {
        availability: "available",
        buyer: { name: "Ana" },
      }).expect(400);

      expect(await buyerRows()).toEqual([]);
    });

    it("answers 404 and changes nothing for a seller on an unassigned listing", async () => {
      const listing = await insertListing(ctx.dataSource, admin);
      const seller = await addMember(ctx, admin, {
        email: "vera@example.com",
        name: "Vera",
        role: "seller",
      });

      await as(ctx.app, seller.cookie)
        .patch(`${base()}/${listing.id}/status`)
        .send({ availability: "reserved", buyer: { name: "Ana" } })
        .expect(404);

      expect((await saleOf(listing.id)).availability).toBe("available");
      expect(await buyerRows()).toEqual([]);
    });

    it("still reserves without a buyer", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      const res = await setStatus(listing.id, {
        availability: "reserved",
      }).expect(200);

      expect(res.body).toMatchObject({ availability: "reserved", sale: null });
    });
  });

  describe("editing the sale", () => {
    const editSale = (id: string, body: object) =>
      client().patch(`${base()}/${id}/sale`).send(body);

    const saleOf = async (id: string) => {
      const [row] = await ctx.dataSource.query(
        `SELECT buyer_id, agreed_price_cents, paid, sale_notes, availability FROM listings WHERE id = $1`,
        [id],
      );
      return row;
    };

    const soldTo = async (name = "Ana") => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "sold",
      });
      const buyerId = await insertBuyer(name);
      await sellTo(listing.id, buyerId, {
        price: 7000,
        paid: false,
        notes: "retira sábado",
      });
      return { listing, buyerId };
    };

    it("adds a buyer to a legacy sold listing and keeps it sold", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "sold",
      });

      const res = await editSale(listing.id, {
        buyer: { name: "João" },
      }).expect(200);

      expect(res.body).toMatchObject({
        availability: "sold",
        sale: { buyer: { name: "João" }, paid: false },
      });
    });

    it("answers 409 and changes nothing for sale info on an available listing", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      const res = await editSale(listing.id, { paid: true }).expect(409);

      expect(res.body.detail).toBe("O anúncio mudou. Recarregue a página.");
      expect((await saleOf(listing.id)).paid).toBe(false);
    });

    it("sets paid without touching buyer, price or notes", async () => {
      const { listing, buyerId } = await soldTo();

      await editSale(listing.id, { paid: true }).expect(200);

      expect(await saleOf(listing.id)).toMatchObject({
        buyer_id: buyerId,
        agreed_price_cents: 7000,
        paid: true,
        sale_notes: "retira sábado",
      });
    });

    it("answers 400 and changes nothing for a null buyer", async () => {
      const { listing, buyerId } = await soldTo();

      await editSale(listing.id, { buyer: null }).expect(400);

      expect((await saleOf(listing.id)).buyer_id).toBe(buyerId);
    });

    it("answers 400 for sale info on a legacy listing without a buyer", async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "reserved",
      });

      await editSale(listing.id, { paid: true }).expect(400);

      expect((await saleOf(listing.id)).paid).toBe(false);
    });

    it("clears the agreed price with null and the notes with an empty string", async () => {
      const { listing } = await soldTo();

      await editSale(listing.id, { agreedPriceCents: null }).expect(200);
      await editSale(listing.id, { notes: "" }).expect(200);

      expect(await saleOf(listing.id)).toMatchObject({
        agreed_price_cents: null,
        sale_notes: null,
      });
    });

    it("answers 409 and changes nothing for a buyer id that is unknown, deleted or from another store", async () => {
      const { listing, buyerId } = await soldTo();
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const foreign = await insertBuyer("Outra", "outra", other.storeId);
      const deleted = await insertBuyer("Apagada", "apagada");
      await ctx.dataSource.query(`DELETE FROM buyers WHERE id = $1`, [deleted]);

      for (const id of [crypto.randomUUID(), foreign, deleted]) {
        await editSale(listing.id, { buyer: { id } }).expect(409);
      }

      expect((await saleOf(listing.id)).buyer_id).toBe(buyerId);
    });

    it("answers 404 and changes nothing for a seller on an unassigned listing", async () => {
      const { listing } = await soldTo();
      const seller = await addMember(ctx, admin, {
        email: "vera@example.com",
        name: "Vera",
        role: "seller",
      });

      await as(ctx.app, seller.cookie)
        .patch(`${base()}/${listing.id}/sale`)
        .send({ paid: true })
        .expect(404);

      expect((await saleOf(listing.id)).paid).toBe(false);
    });
  });

  describe("full update and duplicate", () => {
    const sold = async () => {
      const listing = await insertListing(ctx.dataSource, admin, {
        availability: "reserved",
      });
      const buyerId = await insertBuyer("Ana");
      await sellTo(listing.id, buyerId, {
        price: 7000,
        paid: true,
        notes: "x",
      });
      return listing;
    };

    it("clears the sale and keeps the buyer when a full update releases the listing", async () => {
      const listing = await sold();

      const res = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ availability: "available" })
        .expect(200);

      expect(res.body).toMatchObject({ availability: "available", sale: null });
      const buyers = await ctx.dataSource.query(`SELECT name FROM buyers`);
      expect(buyers).toEqual([{ name: "Ana" }]);
    });

    it("keeps the sale when a full update changes something else", async () => {
      const listing = await sold();

      const res = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ title: "Novo título" })
        .expect(200);

      expect(res.body.sale).toMatchObject({
        agreedPriceCents: 7000,
        paid: true,
      });
    });

    it("accepts availability in a full update", async () => {
      const listing = await insertListing(ctx.dataSource, admin);

      const res = await client()
        .patch(`${base()}/${listing.id}`)
        .send({ availability: "reserved" })
        .expect(200);

      expect(res.body.availability).toBe("reserved");
    });

    it("answers 400 for a sale key in a full update", async () => {
      const listing = await sold();

      await client()
        .patch(`${base()}/${listing.id}`)
        .send({ paid: false })
        .expect(400);
    });

    it("duplicates a sold listing with a buyer as an available copy without sale", async () => {
      const listing = await sold();

      const res = await client()
        .post(`${base()}/${listing.id}/duplicate`)
        .expect(201);

      expect(res.body).toMatchObject({ availability: "available", sale: null });
    });
  });
});
