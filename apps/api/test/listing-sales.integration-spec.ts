import {
  type Admin,
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
});
