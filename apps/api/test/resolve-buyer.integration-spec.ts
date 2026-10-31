import { resolveBuyer } from "@/buyers/resolve-buyer";
import {
  type Admin,
  createStoreWithAdmin,
  createTestApp,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("resolving a buyer", () => {
  let ctx: TestContext;
  let store: Admin;
  let otherStore: Admin;

  const resolve = (
    ref: Parameters<typeof resolveBuyer>[2],
    storeId = store.storeId,
  ) =>
    ctx.dataSource.transaction((manager) =>
      resolveBuyer(manager, storeId, ref),
    );

  const buyers = (storeId = store.storeId) =>
    ctx.dataSource.query(
      `SELECT id, name, whatsapp_number FROM buyers WHERE store_id = $1 ORDER BY name`,
      [storeId],
    );

  const insertBuyer = async (
    storeId: string,
    name: string,
    nameKey: string,
    whatsapp: string | null = null,
  ): Promise<string> => {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO buyers (store_id, name, name_key, whatsapp_number)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [storeId, name, nameKey, whatsapp],
    );
    return row.id;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    store = await createStoreWithAdmin(ctx, "loja-a");
    otherStore = await createStoreWithAdmin(ctx, "loja-b");
  });
  afterAll(() => ctx.app.close());

  describe("by name", () => {
    it("creates the buyer when the store has none under that name", async () => {
      const buyer = await resolve({ name: "Maria Silva" });

      expect(buyer).toMatchObject({
        name: "Maria Silva",
        whatsappNumber: null,
      });
      expect(await buyers()).toEqual([
        { id: buyer.id, name: "Maria Silva", whatsapp_number: null },
      ]);
    });

    it("links the existing buyer when the name differs only in case, accents and spacing", async () => {
      const existing = await insertBuyer(
        store.storeId,
        "Maria Silva",
        "maria silva",
      );

      const buyer = await resolve({ name: " maria  sílva " });

      expect(buyer).toMatchObject({ id: existing, name: "Maria Silva" });
      expect(await buyers()).toHaveLength(1);
    });

    it("keeps buyers of different stores apart", async () => {
      const first = await resolve({ name: "Maria Silva" });
      const second = await resolve({ name: "Maria Silva" }, otherStore.storeId);

      expect(second.id).not.toBe(first.id);
      expect(await buyers()).toHaveLength(1);
      expect(await buyers(otherStore.storeId)).toHaveLength(1);
    });

    it("creates one buyer when two transactions resolve the same new name", async () => {
      let release = () => {};
      const held = new Promise<void>((resolveHeld) => {
        release = resolveHeld;
      });
      let inserted = () => {};
      const firstInserted = new Promise<void>((r) => {
        inserted = r;
      });
      const first = ctx.dataSource.transaction(async (manager) => {
        const buyer = await resolveBuyer(manager, store.storeId, {
          name: "Zé",
        });
        inserted();
        await held;
        return buyer;
      });
      const lockWaiters = () =>
        ctx.dataSource.query(
          `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'`,
        );
      await firstInserted;
      const second = resolve({ name: "ZÉ" });
      const deadline = Date.now() + 5000;
      while ((await lockWaiters()).length === 0) {
        if (Date.now() > deadline) throw new Error("second never blocked");
        await new Promise((r) => setTimeout(r, 20));
      }
      release();

      const [a, b] = await Promise.all([first, second]);

      expect(a.id).toBe(b.id);
      expect(await buyers()).toHaveLength(1);
      expect(b.name).toBe("Zé");
    });

    it("fills a missing phone and leaves an existing one", async () => {
      const without = await insertBuyer(store.storeId, "Ana", "ana");
      const withPhone = await insertBuyer(
        store.storeId,
        "Bia",
        "bia",
        "5511911112222",
      );

      const filled = await resolve({
        name: "ana",
        whatsappNumber: "5511988887777",
      });
      const kept = await resolve({
        name: "bia",
        whatsappNumber: "5511988887777",
      });

      expect(filled).toMatchObject({
        id: without,
        whatsappNumber: "5511988887777",
      });
      expect(kept).toMatchObject({
        id: withPhone,
        whatsappNumber: "5511911112222",
      });
      expect(await buyers()).toEqual([
        { id: without, name: "Ana", whatsapp_number: "5511988887777" },
        { id: withPhone, name: "Bia", whatsapp_number: "5511911112222" },
      ]);
    });
  });

  describe("by id", () => {
    it("returns the store's buyer", async () => {
      const id = await insertBuyer(store.storeId, "Ana", "ana");

      expect(await resolve({ id })).toMatchObject({ id, name: "Ana" });
    });

    it("fills a missing phone and leaves an existing one", async () => {
      const without = await insertBuyer(store.storeId, "Ana", "ana");
      const withPhone = await insertBuyer(
        store.storeId,
        "Bia",
        "bia",
        "5511911112222",
      );

      await resolve({ id: without, whatsappNumber: "5511988887777" });
      await resolve({ id: withPhone, whatsappNumber: "5511988887777" });

      expect(await buyers()).toEqual([
        { id: without, name: "Ana", whatsapp_number: "5511988887777" },
        { id: withPhone, name: "Bia", whatsapp_number: "5511911112222" },
      ]);
    });

    it("answers 409 for an unknown id and for another store's buyer, writing nothing", async () => {
      const foreign = await insertBuyer(otherStore.storeId, "Ana", "ana");

      for (const id of [foreign, "00000000-0000-0000-0000-000000000000"]) {
        await expect(
          resolve({ id, whatsappNumber: "5511988887777" }),
        ).rejects.toMatchObject({ status: 409 });
      }

      expect(await buyers()).toEqual([]);
      expect(await buyers(otherStore.storeId)).toEqual([
        { id: foreign, name: "Ana", whatsapp_number: null },
      ]);
    });
  });
});
