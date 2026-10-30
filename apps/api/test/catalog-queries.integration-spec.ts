import {
  type Admin,
  as,
  createStoreWithAdmin,
  createTestApp,
  photo,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("admin listing summaries", () => {
  let ctx: TestContext;
  let admin: Admin;
  const base = () => `/stores/${admin.storeId}/listings`;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  it("rejects unknown or over-long filters on the admin listing table", async () => {
    const client = as(ctx.app, admin.cookie);
    const unknown = await client.get(`${base()}?status=draft`).expect(400);
    expect(unknown.body.errors).toEqual([
      { pointer: "/query/status", detail: "Campo não permitido." },
    ]);
    const long = await client.get(`${base()}?q=${"a".repeat(101)}`).expect(400);
    expect(long.body.errors).toEqual([
      { pointer: "/query/q", detail: "Valor inválido." },
    ]);
  });

  it("reports the cover and photo count for listings with 0, 1 and several photos", async () => {
    const client = as(ctx.app, admin.cookie);
    const ids: string[] = [];
    for (const title of ["Zero", "Um", "Varias"]) {
      const res = await client
        .post(base())
        .send({
          title,
          categoryId: admin.categoryId,
          sellerIds: [admin.sellerId],
          condition: "good",
        })
        .expect(201);
      ids.push(res.body.id);
    }
    await client
      .post(`${base()}/${ids[1]}/images`)
      .attach("files", await photo(), "a.jpg")
      .expect(201);
    const many = await client
      .post(`${base()}/${ids[2]}/images`)
      .attach("files", await photo("#111111"), "a.jpg")
      .attach("files", await photo("#222222"), "b.jpg")
      .attach("files", await photo("#333333"), "c.jpg")
      .expect(201);

    const list = await client.get(base()).expect(200);
    const byTitle = Object.fromEntries(
      list.body.items.map((l: { title: string }) => [l.title, l]),
    );
    expect(byTitle.Zero).toMatchObject({ imageCount: 0, coverUrl: null });
    expect(byTitle.Um.imageCount).toBe(1);
    expect(byTitle.Um.coverUrl).toMatch(/\.webp$/);
    expect(byTitle.Varias.imageCount).toBe(3);
    expect(byTitle.Varias.coverUrl).toBe(many.body.items[0].urls.sm);
  });
});
