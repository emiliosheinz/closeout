import {
  type Admin,
  addMember,
  as,
  createStoreWithAdmin,
  createTestApp,
  insertListing,
  type Member,
  resetDatabase,
  type TestContext,
} from "./helpers";

interface Sale {
  availability: "reserved" | "sold";
  agreedPriceCents?: number;
  paid?: boolean;
}

describe("buyers", () => {
  let ctx: TestContext;
  let admin: Admin;
  let seller: Member;
  const client = () => as(ctx.app, admin.cookie);
  const base = () => `/stores/${admin.storeId}/buyers`;

  /** Sell a fresh listing to `buyer` through the status endpoint. */
  const sell = async (
    buyer: string | { id: string },
    sale: Sale,
    title = "Item",
    sellerIds?: string[],
  ) => {
    const listing = await insertListing(ctx.dataSource, admin, {
      title,
      sellerIds,
    });
    const ref = typeof buyer === "string" ? { name: buyer } : buyer;
    await client()
      .patch(`/stores/${admin.storeId}/listings/${listing.id}/status`)
      .send({ ...sale, buyer: ref })
      .expect(200);
    return listing;
  };

  const find = async (name: string, who = client()) => {
    const res = await who.get(base()).expect(200);
    return res.body.items.find((b: { name: string }) => b.name === name);
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
    seller = await addMember(ctx, admin, {
      email: "vendedora@example.com",
      name: "Vendedora",
      role: "seller",
    });
  });
  afterAll(() => ctx.app.close());

  describe("listing", () => {
    it("sums unpaid agreed prices, counts unpriced unpaid items and lists every item", async () => {
      await sell("Ana", { availability: "reserved", agreedPriceCents: 10000 });
      await sell("Ana", { availability: "sold" });
      await sell("Ana", {
        availability: "sold",
        agreedPriceCents: 5000,
        paid: true,
      });

      const ana = await find("Ana");

      expect(ana.owedCents).toBe(10000);
      expect(ana.unpricedCount).toBe(1);
      expect(ana.items).toHaveLength(3);
      expect(ana.linkedCount).toBe(3);
    });

    it("counts an unpaid sale on a draft listing as owed", async () => {
      await sell("Ana", { availability: "sold", agreedPriceCents: 3000 });

      expect((await find("Ana")).owedCents).toBe(3000);
    });

    it("shows a seller only the items of listings they sell, with the store-wide linked count", async () => {
      await sell(
        "Ana",
        { availability: "sold", agreedPriceCents: 4000 },
        "Meu",
        [seller.sellerId],
      );
      await sell(
        "Ana",
        { availability: "sold", agreedPriceCents: 9000 },
        "Outro",
      );
      await sell("Bia", { availability: "sold", agreedPriceCents: 2000 });

      const asSeller = as(ctx.app, seller.cookie);
      const ana = await find("Ana", asSeller);
      const bia = await find("Bia", asSeller);

      expect(ana.items.map((i: { title: string }) => i.title)).toEqual(["Meu"]);
      expect(ana.owedCents).toBe(4000);
      expect(ana.linkedCount).toBe(2);
      expect(bia.items).toEqual([]);
      expect(bia.owedCents).toBe(0);
      expect(bia.linkedCount).toBe(1);
    });

    it("leaves out the buyers of another store", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      await ctx.dataSource.query(
        `INSERT INTO buyers (store_id, name, name_key) VALUES ($1, 'Carla', 'carla')`,
        [other.storeId],
      );

      const res = await client().get(base()).expect(200);

      expect(res.body.items).toEqual([]);
    });

    it("keeps listing a buyer after their listing is released", async () => {
      const maria = await sell("Maria", {
        availability: "reserved",
        agreedPriceCents: 1000,
      });
      await client()
        .patch(`/stores/${admin.storeId}/listings/${maria.id}/status`)
        .send({ availability: "available" })
        .expect(200);

      const entry = await find("Maria");

      expect(entry.items).toEqual([]);
      expect(entry.linkedCount).toBe(0);
    });

    it("shows a price changed through the sale endpoint", async () => {
      const listing = await sell("Ana", {
        availability: "reserved",
        agreedPriceCents: 10000,
      });
      await client()
        .patch(`/stores/${admin.storeId}/listings/${listing.id}/sale`)
        .send({ agreedPriceCents: 6000 })
        .expect(200);

      const ana = await find("Ana");

      expect(ana.items[0].agreedPriceCents).toBe(6000);
    });
  });

  describe("editing", () => {
    const insert = async (
      name: string,
      key: string,
      storeId = admin.storeId,
    ) => {
      const [row] = await ctx.dataSource.query(
        `INSERT INTO buyers (store_id, name, name_key) VALUES ($1, $2, $3) RETURNING id`,
        [storeId, name, key],
      );
      return row.id as string;
    };
    const stored = async (id: string) => {
      const [row] = await ctx.dataSource.query(
        `SELECT name, whatsapp_number FROM buyers WHERE id = $1`,
        [id],
      );
      return row;
    };

    it("lets a seller rename a buyer", async () => {
      const id = await insert("Ana", "ana");

      const res = await as(ctx.app, seller.cookie)
        .patch(`${base()}/${id}`)
        .send({ name: "Ana Lima" })
        .expect(200);

      expect(res.body).toEqual({ id, name: "Ana Lima", whatsappNumber: null });
    });

    it("accepts a rename that only changes the case", async () => {
      const id = await insert("Ana", "ana");

      await client().patch(`${base()}/${id}`).send({ name: "ANA" }).expect(200);

      expect((await stored(id)).name).toBe("ANA");
    });

    it("refuses a rename to another buyer's name and keeps the old name", async () => {
      const id = await insert("Ana", "ana");
      await insert("Bia Souza", "bia souza");

      const res = await client()
        .patch(`${base()}/${id}`)
        .send({ name: "bía  SOUZA" })
        .expect(409);

      expect(res.body.detail).toBe(
        "Já existe um comprador com esse nome. Use Juntar com...",
      );
      expect((await stored(id)).name).toBe("Ana");
    });

    it("stores a formatted phone as digits", async () => {
      const id = await insert("Ana", "ana");

      const res = await client()
        .patch(`${base()}/${id}`)
        .send({ whatsappNumber: "+55 (11) 98888-7777" })
        .expect(200);

      expect(res.body.whatsappNumber).toBe("5511988887777");
      expect((await stored(id)).whatsapp_number).toBe("5511988887777");
    });

    it("refuses a phone without a plus and keeps the stored one", async () => {
      const id = await insert("Ana", "ana");
      await client()
        .patch(`${base()}/${id}`)
        .send({ whatsappNumber: "+5511988887777" })
        .expect(200);

      await client()
        .patch(`${base()}/${id}`)
        .send({ whatsappNumber: "11988887777" })
        .expect(400);

      expect((await stored(id)).whatsapp_number).toBe("5511988887777");
    });

    it("clears the phone", async () => {
      const id = await insert("Ana", "ana");
      await client()
        .patch(`${base()}/${id}`)
        .send({ whatsappNumber: "+5511988887777" })
        .expect(200);

      await client()
        .patch(`${base()}/${id}`)
        .send({ whatsappNumber: null })
        .expect(200);

      expect((await stored(id)).whatsapp_number).toBeNull();
    });

    it("answers 404 for an unknown buyer and for another store's buyer", async () => {
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const foreign = await insert("Carla", "carla", other.storeId);

      await client()
        .patch(`${base()}/00000000-0000-4000-8000-000000000000`)
        .send({ name: "X" })
        .expect(404);
      await client()
        .patch(`${base()}/${foreign}`)
        .send({ name: "X" })
        .expect(404);
      expect((await stored(foreign)).name).toBe("Carla");
    });
  });
});
