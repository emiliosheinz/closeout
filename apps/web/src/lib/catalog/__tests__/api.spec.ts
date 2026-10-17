/** @jest-environment node */
import { getListing, getListings } from "../api";
import { DEFAULT_FILTERS } from "../params";

const page = { items: [], total: 0, page: 1, pageSize: 24 };

describe("catalog fetch caching", () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    process.env.STORE_SLUG = "loja";
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => Response.json(page));
  });
  afterEach(() => fetchMock.mockRestore());

  const initOf = (call: number) => fetchMock.mock.calls[call][1];

  it("caches the unfiltered catalog and listing pages under the catalog tag", async () => {
    await getListings({ ...DEFAULT_FILTERS, page: 2, sort: "price_asc" });
    await getListing("abajur");
    for (const call of [0, 1]) {
      expect(initOf(call)).toEqual({
        next: { revalidate: 300, tags: ["catalog"] },
      });
    }
  });

  it("skips the cache for searches and filters", async () => {
    await getListings({ ...DEFAULT_FILTERS, q: "abajur" });
    await getListings({ ...DEFAULT_FILTERS, maxPrice: 50 });
    await getListings({ ...DEFAULT_FILTERS, availability: "sold" });
    for (const call of [0, 1, 2]) {
      expect(initOf(call)).toEqual({ cache: "no-store" });
    }
  });
});
