import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getListings, getStoreSlugs } from "@/lib/catalog/api";
import sitemap from "../sitemap";

jest.mock("@/lib/catalog/api", () => ({
  getListings: jest.fn(),
  getStoreSlugs: jest.fn(),
}));

const listings = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    slug: `${prefix}-${from + i}`,
  }));

beforeEach(() => {
  process.env.PUBLIC_BASE_URL = "https://closeout.example";
  jest
    .mocked(getStoreSlugs)
    .mockResolvedValue(["nosso-desapego", "loja-da-bia"]);
  jest.mocked(getListings).mockImplementation((async (
    slug: string,
    filters: { page: number },
  ) => {
    if (slug === "loja-da-bia") return { items: listings("b", 1, 1), total: 1 };
    return filters.page === 1
      ? { items: listings("a", 1, 100), total: 101 }
      : { items: listings("a", 101, 101), total: 101 };
  }) as never);
});

describe("sitemap", () => {
  it("lists every store and every listing across pages with absolute URLs", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toHaveLength(2 + 101 + 1);
    expect(urls).toContain("https://closeout.example/store/nosso-desapego");
    expect(urls).toContain("https://closeout.example/store/loja-da-bia");
    expect(urls).toContain(
      "https://closeout.example/store/nosso-desapego/items/a-1",
    );
    expect(urls).toContain(
      "https://closeout.example/store/nosso-desapego/items/a-101",
    );
    expect(urls).toContain(
      "https://closeout.example/store/loja-da-bia/items/b-1",
    );
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("requests sold listings too, 100 per page, until the total is covered", async () => {
    await sitemap();
    const calls = jest.mocked(getListings).mock.calls;
    expect(calls.map(([slug, f]) => [slug, f.page])).toEqual([
      ["nosso-desapego", 1],
      ["nosso-desapego", 2],
      ["loja-da-bia", 1],
    ]);
    for (const [, filters, size] of calls) {
      expect(filters.availability).toBe("all");
      expect(size).toBe(100);
    }
  });

  it("renders byte for byte the recorded output", async () => {
    const baseline = readFileSync(
      join(__dirname, "sitemap.baseline.txt"),
      "utf8",
    );
    expect(JSON.stringify(await sitemap(), null, 2)).toBe(baseline);
  });
});
