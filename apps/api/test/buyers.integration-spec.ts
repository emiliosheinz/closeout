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

  describe("deleting", () => {
    const HAS_ITEMS =
      "Este comprador tem itens vinculados em anúncios da loja. Junte-o a outro comprador.";
    const buyerId = async (name: string) => (await find(name)).id as string;
    const remaining = async () =>
      (await client().get(base()).expect(200)).body.items.map(
        (b: { name: string }) => b.name,
      );

    it("lets a seller delete a buyer with no listings", async () => {
      const release = await sell("Ana", { availability: "reserved" });
      await client()
        .patch(`/stores/${admin.storeId}/listings/${release.id}/status`)
        .send({ availability: "available" })
        .expect(200);

      await as(ctx.app, seller.cookie)
        .delete(`${base()}/${await buyerId("Ana")}`)
        .expect(204);

      expect(await remaining()).toEqual([]);
    });

    it("refuses to delete a buyer linked to a listing the actor sees", async () => {
      const listing = await sell("Ana", { availability: "sold" });

      const res = await client()
        .delete(`${base()}/${await buyerId("Ana")}`)
        .expect(409);

      expect(res.body.detail).toBe(HAS_ITEMS);
      expect(await remaining()).toEqual(["Ana"]);
      const [row] = await ctx.dataSource.query(
        `SELECT buyer_id FROM listings WHERE id = $1`,
        [listing.id],
      );
      expect(row.buyer_id).not.toBeNull();
    });

    it("refuses to delete a buyer linked only to a listing the seller cannot see", async () => {
      await sell("Ana", { availability: "sold" });

      await as(ctx.app, seller.cookie)
        .delete(`${base()}/${await buyerId("Ana")}`)
        .expect(409);

      expect(await remaining()).toEqual(["Ana"]);
    });

    it("answers 404 for an unknown buyer", async () => {
      await client()
        .delete(`${base()}/00000000-0000-4000-8000-000000000000`)
        .expect(404);
    });
  });

  describe("merging", () => {
    const TARGET_GONE =
      "Esse comprador foi juntado ou removido. Escolha o comprador de novo.";
    const withPhone = (id: string, phone: string) =>
      ctx.dataSource.query(
        `UPDATE buyers SET whatsapp_number = $2 WHERE id = $1`,
        [id, phone],
      );
    const merge = (who: ReturnType<typeof client>, from: string, to: string) =>
      who.post(`${base()}/${from}/merge`).send({ targetId: to });
    const count = async () =>
      (await ctx.dataSource.query(`SELECT count(*)::int AS n FROM buyers`))[0]
        .n;

    it("moves the listings with their sale info, fills the empty phone and removes the source", async () => {
      const first = await sell("A", {
        availability: "sold",
        agreedPriceCents: 7000,
        paid: true,
      });
      await client()
        .patch(`/stores/${admin.storeId}/listings/${first.id}/sale`)
        .send({ notes: "retira sábado" })
        .expect(200);
      await sell("A", { availability: "reserved", agreedPriceCents: 500 });
      await sell("B", { availability: "reserved" });
      const [a, b] = [(await find("A")).id, (await find("B")).id];
      await withPhone(a, "5511911112222");

      const res = await merge(as(ctx.app, seller.cookie), a, b).expect(201);

      expect(res.body).toEqual({
        id: b,
        name: "B",
        whatsappNumber: "5511911112222",
      });
      const merged = await find("B");
      expect(merged.items).toHaveLength(3);
      expect(merged.linkedCount).toBe(3);
      expect(await find("A")).toBeUndefined();
      const [row] = await ctx.dataSource.query(
        `SELECT agreed_price_cents, paid, sale_notes FROM listings WHERE id = $1`,
        [first.id],
      );
      expect(row).toEqual({
        agreed_price_cents: 7000,
        paid: true,
        sale_notes: "retira sábado",
      });
    });

    it("keeps the phone the target already has", async () => {
      await sell("A", { availability: "reserved" });
      await sell("B", { availability: "reserved" });
      const [a, b] = [(await find("A")).id, (await find("B")).id];
      await withPhone(a, "5511911112222");
      await withPhone(b, "5521933334444");

      const res = await merge(client(), a, b).expect(201);

      expect(res.body.whatsappNumber).toBe("5521933334444");
    });

    it("refuses to merge a buyer into itself and changes nothing", async () => {
      await sell("A", { availability: "reserved" });
      const a = (await find("A")).id;

      await merge(client(), a, a).expect(422);

      expect((await find("A")).linkedCount).toBe(1);
    });

    it("answers 409 for a target that is unknown or in another store and changes nothing", async () => {
      await sell("A", { availability: "reserved" });
      const a = (await find("A")).id;
      const other = await createStoreWithAdmin(ctx, "loja-b");
      const [foreign] = await ctx.dataSource.query(
        `INSERT INTO buyers (store_id, name, name_key) VALUES ($1, 'Carla', 'carla') RETURNING id`,
        [other.storeId],
      );

      const unknown = await merge(
        client(),
        a,
        "00000000-0000-4000-8000-000000000000",
      ).expect(409);
      await merge(client(), a, foreign.id).expect(409);

      expect(unknown.body.detail).toBe(TARGET_GONE);
      expect((await find("A")).linkedCount).toBe(1);
      expect(await count()).toBe(2);
    });

    it("answers 404 for an unknown source", async () => {
      await sell("B", { availability: "reserved" });

      await merge(
        client(),
        "00000000-0000-4000-8000-000000000000",
        (await find("B")).id,
      ).expect(404);
    });

    it("refuses a status change that names the merged buyer", async () => {
      await sell("A", { availability: "reserved" });
      await sell("B", { availability: "reserved" });
      const [a, b] = [(await find("A")).id, (await find("B")).id];
      await merge(client(), a, b).expect(201);
      const listing = await insertListing(ctx.dataSource, admin);

      await client()
        .patch(`/stores/${admin.storeId}/listings/${listing.id}/status`)
        .send({ availability: "reserved", buyer: { id: a } })
        .expect(409);
    });
  });
});
