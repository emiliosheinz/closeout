/** @vitest-environment node */
import type { MockInstance } from "vitest";
import { DEFAULT_FILTERS } from "../../model/filters";
import { getListing, getListings, getStore, getStoreSlugs } from "../catalog";

const summary = {
  slug: "abajur",
  title: "Abajur",
  priceCents: 5000,
  condition: "good",
  availability: "available",
  category: { slug: "casa", name: "Casa" },
  cover: null,
};
const store = {
  slug: "loja-da-bia",
  name: "Loja da Bia",
  headline: "",
  intro: "",
  locale: "pt-BR",
  currency: "BRL",
  counts: { available: 1, reserved: 0, sold: 0 },
  categories: [],
  sellers: [],
};
const detail = {
  ...summary,
  description: "",
  attributes: [],
  images: [],
  sellers: [],
  canContact: false,
  publishedAt: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  related: [],
};
const page = { items: [], total: 0, page: 1, pageSize: 24 };

/** Answers each public path with the body the API would send for it. */
function answer(url: unknown) {
  const path = String(url);
  if (path.includes("/listings?")) return Response.json(page);
  if (path.includes("/listings/")) return Response.json(detail);
  return Response.json(store);
}

describe("catalog fetch caching", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (url) => answer(url));
  });
  afterEach(() => fetchMock.mockRestore());

  const initOf = (call: number) => fetchMock.mock.calls[call]?.[1];
  const urlOf = (call: number) => fetchMock.mock.calls[call]?.[0];

  it("asks for the store the caller names", async () => {
    await getStore("nosso-desapego");
    await getListing("loja-da-bia", "abajur");
    await getListings("loja-da-bia", DEFAULT_FILTERS);
    expect(urlOf(0)).toBe("http://api:3000/public/stores/nosso-desapego");
    expect(urlOf(1)).toBe(
      "http://api:3000/public/stores/loja-da-bia/listings/abajur",
    );
    expect(urlOf(2)).toBe(
      "http://api:3000/public/stores/loja-da-bia/listings?sort=recent&page=1&pageSize=24&availability=listed",
    );
  });

  it("lists every store slug without caching", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        items: [{ slug: "nosso-desapego" }, { slug: "loja-da-bia" }],
      }),
    );
    await expect(getStoreSlugs()).resolves.toEqual([
      "nosso-desapego",
      "loja-da-bia",
    ]);
    expect(urlOf(0)).toBe("http://api:3000/public/stores");
    expect(initOf(0)).toEqual({ cache: "no-store" });
  });

  it("caches the store, listing pages and the plain first catalog page", async () => {
    await getListings("loja", { ...DEFAULT_FILTERS, sort: "price_asc" });
    await getListing("loja", "abajur");
    await getStore("loja");
    for (const call of [0, 1, 2]) {
      expect(initOf(call)).toEqual({
        next: { revalidate: 300, tags: ["catalog"] },
      });
    }
  });

  it("skips the cache for searches, filters and deep pages", async () => {
    await getListings("loja", { ...DEFAULT_FILTERS, q: "abajur" });
    await getListings("loja", { ...DEFAULT_FILTERS, maxPrice: 50 });
    await getListings("loja", { ...DEFAULT_FILTERS, availability: "sold" });
    await getListings("loja", { ...DEFAULT_FILTERS, page: 2 });
    for (const call of [0, 1, 2, 3]) {
      expect(initOf(call)).toEqual({ cache: "no-store" });
    }
  });
});

describe("catalog response parsing", () => {
  let fetchMock: MockInstance;
  let logged: MockInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    fetchMock = vi.spyOn(global, "fetch");
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("drops listing items that fail their schema, logs them and keeps the raw count", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        ...page,
        total: 3,
        items: [summary, { slug: "sem-titulo" }, { ...summary, slug: "mesa" }],
      }),
    );
    const result = await getListings("loja", DEFAULT_FILTERS);
    expect(result.items.map((item) => item.slug)).toEqual(["abajur", "mesa"]);
    expect(result.received).toBe(3);
    expect(result.total).toBe(3);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("reports nothing received for a page past the end", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...page, total: 5 }));
    await expect(
      getListings("loja", { ...DEFAULT_FILTERS, page: 9 }),
    ).resolves.toMatchObject({ items: [], received: 0, total: 5 });
  });

  it("drops sitemap store entries that fail their schema", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ items: [{ slug: "loja" }, { name: "sem slug" }] }),
    );
    await expect(getStoreSlugs()).resolves.toEqual(["loja"]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("logs and throws when a detail response misses a required field", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...detail, title: undefined }));
    await expect(getListing("loja", "abajur")).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
    fetchMock.mockResolvedValue(Response.json({ ...store, name: undefined }));
    await expect(getStore("loja")).rejects.toThrow();
  });

  it("ignores fields the schema does not declare", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...store, extra: "x" }));
    const result = await getStore("loja-da-bia");
    expect(result).toEqual(store);
  });

  it("answers null for an unknown store", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(getStore("sumiu")).resolves.toBeNull();
  });
});
