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

describe("public catalog", () => {
  let ctx: TestContext;
  let admin: Admin;
  const get = (path: string) =>
    request(ctx.app.getHttpServer()).get(`/public/stores/loja-a${path}`);
  const titles = async (query: string) => {
    const res = await get(`/listings${query}`).expect(200);
    return res.body.items.map((item: { title: string }) => item.title);
  };
  const publish = (fields: Parameters<typeof insertListing>[2]) =>
    insertListing(ctx.dataSource, admin, {
      publication: "published",
      ...fields,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.dataSource);
    admin = await createStoreWithAdmin(ctx, "loja-a");
  });
  afterAll(() => ctx.app.close());

  it("lists the slug of every store and nothing else", async () => {
    await createStoreWithAdmin(ctx, "loja-b");
    await ctx.dataSource.query(
      `INSERT INTO stores (slug, name) VALUES ('loja-vazia', 'Loja vazia')`,
    );
    const res = await request(ctx.app.getHttpServer())
      .get("/public/stores")
      .expect(200);
    expect(res.body).toEqual({
      items: [{ slug: "loja-a" }, { slug: "loja-b" }, { slug: "loja-vazia" }],
    });
  });

  it("lists published listings only", async () => {
    await publish({ title: "Publicado" });
    await insertListing(ctx.dataSource, admin, {
      title: "Rascunho",
      publication: "draft",
    });
    await insertListing(ctx.dataSource, admin, {
      title: "Arquivado",
      publication: "archived",
    });
    expect(await titles("")).toEqual(["Publicado"]);
  });

  it("searches title and description ignoring case and accents", async () => {
    await publish({ title: "Sofá retrátil" });
    await publish({
      title: "Poltrona",
      description: "Combina com o SOFA da sala",
    });
    await publish({ title: "Geladeira" });
    expect((await titles("?q=sofa")).sort()).toEqual([
      "Poltrona",
      "Sofá retrátil",
    ]);
    expect(await titles("?q=GELADEÍRA")).toEqual(["Geladeira"]);
  });

  it("matches LIKE wildcards literally", async () => {
    await publish({ title: "Desconto 50% na mesa" });
    await publish({ title: "Mesa" });
    expect(await titles("?q=%25")).toEqual(["Desconto 50% na mesa"]);
    expect(await titles("?q=_")).toEqual([]);
  });

  it("combines category, condition and price filters", async () => {
    await publish({
      title: "Match",
      category: "moveis",
      condition: "good",
      priceCents: 40000,
    });
    await publish({
      title: "Caro",
      category: "moveis",
      condition: "good",
      priceCents: 90000,
    });
    await publish({
      title: "Outra categoria",
      category: "cozinha",
      condition: "good",
      priceCents: 100,
    });
    await publish({
      title: "Outro estado",
      category: "moveis",
      condition: "fair",
      priceCents: 100,
    });
    await publish({
      title: "Sem preço",
      category: "moveis",
      condition: "good",
      priceCents: null,
    });
    expect(
      await titles("?category=moveis&condition=good&maxPrice=50000"),
    ).toEqual(["Match"]);
    expect(
      await titles("?category=moveis&condition=good&minPrice=50000"),
    ).toEqual(["Caro"]);
  });

  it("combines search, filters and sorting in one query", async () => {
    await publish({
      title: "Mesa de jantar",
      category: "moveis",
      condition: "good",
      priceCents: 30000,
    });
    await publish({
      title: "Mesa de centro",
      category: "moveis",
      condition: "good",
      priceCents: 10000,
    });
    await publish({
      title: "Mesa dobrável",
      category: "moveis",
      condition: "fair",
      priceCents: 5000,
    });
    await publish({
      title: "Mesa de som",
      category: "eletronicos",
      condition: "good",
      priceCents: 1000,
    });
    await publish({
      title: "Cadeira",
      category: "moveis",
      condition: "good",
      priceCents: 2000,
    });
    expect(
      await titles(
        "?q=mesa&category=moveis&condition=good&maxPrice=40000&sort=price_asc",
      ),
    ).toEqual(["Mesa de centro", "Mesa de jantar"]);
  });

  it("sorts by price with unpriced listings last, and by recency", async () => {
    const day = (n: number) => new Date(Date.UTC(2026, 0, n));
    await publish({ title: "Médio", priceCents: 5000, publishedAt: day(1) });
    await publish({
      title: "Sem preço",
      priceCents: null,
      publishedAt: day(4),
    });
    await publish({ title: "Barato", priceCents: 1000, publishedAt: day(2) });
    await publish({ title: "Caro", priceCents: 9000, publishedAt: day(3) });
    expect(await titles("?sort=price_asc")).toEqual([
      "Barato",
      "Médio",
      "Caro",
      "Sem preço",
    ]);
    expect(await titles("?sort=price_desc")).toEqual([
      "Caro",
      "Médio",
      "Barato",
      "Sem preço",
    ]);
    expect(await titles("?sort=recent")).toEqual([
      "Sem preço",
      "Caro",
      "Barato",
      "Médio",
    ]);
    expect(await titles("")).toEqual(["Sem preço", "Caro", "Barato", "Médio"]);
  });

  it("hides sold listings by default and filters by availability on request", async () => {
    await publish({ title: "Livre", availability: "available" });
    await publish({ title: "Reservado", availability: "reserved" });
    await publish({ title: "Vendido", availability: "sold" });
    expect((await titles("")).sort()).toEqual(["Livre", "Reservado"]);
    expect(await titles("?availability=sold")).toEqual(["Vendido"]);
    expect(await titles("?availability=reserved")).toEqual(["Reservado"]);
    expect((await titles("?availability=all")).sort()).toEqual([
      "Livre",
      "Reservado",
      "Vendido",
    ]);
  });

  it("paginates with a stable total", async () => {
    for (let i = 1; i <= 5; i++) {
      await publish({
        title: `Item ${i}`,
        publishedAt: new Date(Date.UTC(2026, 0, i)),
      });
    }
    const page2 = await get("/listings?pageSize=2&page=2").expect(200);
    expect(page2.body).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(page2.body.items.map((i: { title: string }) => i.title)).toEqual([
      "Item 3",
      "Item 2",
    ]);
    const beyond = await get("/listings?pageSize=2&page=9").expect(200);
    expect(beyond.body).toMatchObject({ items: [], total: 5 });
  });

  it("returns an empty page when nothing matches", async () => {
    await publish({ title: "Mesa" });
    const res = await get("/listings?q=helicoptero").expect(200);
    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it("rejects malformed query values", async () => {
    await get("/listings?sort=random").expect(400);
    await get("/listings?page=0").expect(400);
    await get("/listings?minPrice=abc").expect(400);
    await get("/listings?maxPrice=1e20").expect(400);
    await get("/listings?minPrice=100000001").expect(400);
  });

  it("accepts query numbers at their bounds", async () => {
    await publish({ title: "Mesa", priceCents: 0 });
    const res = await get(
      "/listings?page=1000&pageSize=100&minPrice=0&maxPrice=100000000",
    ).expect(200);
    expect(res.body).toMatchObject({ page: 1000, pageSize: 100, total: 1 });
    const first = await get("/listings?page=1&pageSize=1").expect(200);
    expect(first.body).toMatchObject({ page: 1, pageSize: 1 });
  });

  it.each([
    ["page", "1001"],
    ["page", "1.5"],
    ["pageSize", "0"],
    ["pageSize", "101"],
    ["minPrice", "-1"],
    ["minPrice", "10.5"],
    ["maxPrice", "100000001"],
  ])("reports %s=%s at its query pointer", async (name, value) => {
    const res = await get(`/listings?${name}=${value}`).expect(400);
    expect(res.body.errors).toEqual([
      { pointer: `/query/${name}`, detail: "Valor inválido." },
    ]);
  });

  it("reports an unknown query key at its query pointer", async () => {
    const res = await get("/listings?color=blue").expect(400);
    expect(res.body.errors).toEqual([
      { pointer: "/query/color", detail: "Campo não permitido." },
    ]);
  });

  it("answers 404 for malformed store and listing slugs", async () => {
    const server = ctx.app.getHttpServer();
    for (const path of [
      "/public/stores/Loja%20A",
      "/public/stores/Loja%20A/listings",
      "/public/stores/loja-a/listings/..%2Fmesa",
      `/public/stores/loja-a/listings/${"x".repeat(300)}`,
    ]) {
      const res = await request(server).get(path).expect(404);
      expect(res.body.detail).toBe("Não encontrado.");
    }
  });

  it("answers 404 for drafts, archived listings and unknown stores", async () => {
    const draft = await insertListing(ctx.dataSource, admin, {
      publication: "draft",
    });
    const archived = await insertListing(ctx.dataSource, admin, {
      publication: "archived",
    });
    const hidden = await get(`/listings/${draft.slug}`).expect(404);
    await get(`/listings/${archived.slug}`).expect(404);
    const unknownStore = await request(ctx.app.getHttpServer())
      .get("/public/stores/nope/listings")
      .expect(404);
    expect(hidden.body.detail).toBe("Não encontrado.");
    expect(unknownStore.body.detail).toBe("Não encontrado.");
  });

  it("serves full detail for a published listing with its seller's contact", async () => {
    const listing = await publish({
      title: "Bicicleta",
      description: "Aro 29",
      priceCents: 140000,
      condition: "like_new",
      category: "esporte-e-lazer",
    });
    const res = await get(`/listings/${listing.slug}`).expect(200);
    expect(res.body).toMatchObject({
      slug: listing.slug,
      title: "Bicicleta",
      description: "Aro 29",
      priceCents: 140000,
      condition: "like_new",
      availability: "available",
      category: { slug: "esporte-e-lazer", name: "Esporte e lazer" },
      sellers: [{ name: "Admin loja-a", whatsappNumber: "5511999998888" }],
      canContact: true,
      cover: null,
      images: [],
    });
  });

  it("keeps a sold listing reachable without any contact data and suggests others", async () => {
    const sold = await publish({ title: "Vendida", availability: "sold" });
    await publish({ title: "Disponível" });
    await publish({ title: "Também vendida", availability: "sold" });
    const res = await get(`/listings/${sold.slug}`).expect(200);
    expect(res.body.availability).toBe("sold");
    expect(res.body.canContact).toBe(false);
    expect(res.body.sellers[0].whatsappNumber).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("11999998888");
    expect(res.body.related.map((r: { title: string }) => r.title)).toEqual([
      "Disponível",
    ]);
  });

  it("never suggests drafts or archived listings as related items", async () => {
    const listing = await publish({ title: "Mesa", category: "moveis" });
    await publish({ title: "Cadeira", category: "moveis" });
    await insertListing(ctx.dataSource, admin, {
      title: "Rascunho",
      category: "moveis",
      publication: "draft",
    });
    await insertListing(ctx.dataSource, admin, {
      title: "Arquivado",
      category: "moveis",
      publication: "archived",
    });
    const res = await get(`/listings/${listing.slug}`).expect(200);
    expect(res.body.related.map((r: { title: string }) => r.title)).toEqual([
      "Cadeira",
    ]);
  });

  it("exposes only intentionally public fields", async () => {
    const listing = await publish({ title: "Mesa" });
    await as(ctx.app, admin.cookie)
      .post(`/stores/${admin.storeId}/listings/${listing.id}/images`)
      .attach("files", await photo(), "a.jpg")
      .expect(201);
    const [image] = await ctx.dataSource.query(
      `SELECT storage_key FROM listing_images WHERE listing_id = $1`,
      [listing.id],
    );
    const bodies = [
      (await get(`/listings/${listing.slug}`).expect(200)).body,
      (await get("/listings").expect(200)).body,
      (await get("").expect(200)).body,
    ];
    for (const body of bodies) {
      const json = JSON.stringify(body);
      for (const secret of [
        "publication",
        "storeId",
        "sellerId",
        "userId",
        "storageKey",
        "passwordHash",
        "loja-a@example.com",
        listing.id,
        admin.storeId,
        admin.sellerId,
      ]) {
        expect(json).not.toContain(secret);
      }
      expect(json).not.toMatch(/\/data\/|MEDIA_DIR|\.\.\//);
    }
    expect(bodies[0].cover.lg).toBe(`/media/${image.storage_key}-lg.webp`);
  });

  it("summarizes the store with derived counts, category counts and reachable sellers", async () => {
    await publish({
      title: "A",
      availability: "available",
      category: "moveis",
    });
    await publish({
      title: "B",
      availability: "available",
      category: "cozinha",
    });
    await publish({ title: "C", availability: "reserved", category: "moveis" });
    await publish({ title: "D", availability: "sold", category: "moveis" });
    await insertListing(ctx.dataSource, admin, {
      title: "E",
      publication: "draft",
    });
    await addMember(ctx, admin, {
      email: "sem-numero@example.com",
      name: "Sem número",
    });

    const res = await get("").expect(200);
    expect(res.body).toMatchObject({
      slug: "loja-a",
      name: "Loja loja-a",
      counts: { available: 2, reserved: 1, sold: 1 },
      sellers: [
        {
          name: "Admin loja-a",
          whatsappNumber: "5511999998888",
          avatarUrl: null,
        },
      ],
    });
    const counts = Object.fromEntries(
      res.body.categories.map((c: { slug: string; count: number }) => [
        c.slug,
        c.count,
      ]),
    );
    expect(counts).toMatchObject({ moveis: 2, cozinha: 1, eletronicos: 0 });
  });
});
