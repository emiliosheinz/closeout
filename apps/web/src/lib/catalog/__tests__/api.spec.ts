/** @jest-environment node */
import { getListing, getListings, getStore, getStoreSlugs } from "../api";
import { DEFAULT_FILTERS } from "../params";

const page = { items: [], total: 0, page: 1, pageSize: 24 };

describe("catalog fetch caching", () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => Response.json(page));
  });
  afterEach(() => fetchMock.mockRestore());

  const initOf = (call: number) => fetchMock.mock.calls[call][1];
  const urlOf = (call: number) => fetchMock.mock.calls[call][0];

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
