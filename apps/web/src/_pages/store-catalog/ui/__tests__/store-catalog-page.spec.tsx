/** @vitest-environment node */
import { getListings, getStore } from "@/entities/listing/index.server";
import { CatalogPage } from "../store-catalog-page";

vi.mock("@/entities/listing/index.server", () => ({
  PAGE_SIZE: 24,
  getListings: vi.fn(),
  getStore: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const store = {
  slug: "loja",
  name: "Loja",
  headline: "",
  intro: "",
  locale: "pt-BR",
  currency: "BRL",
  counts: { available: 0, reserved: 0, sold: 0 },
  categories: [],
  sellers: [],
};

const render = () =>
  CatalogPage({
    params: Promise.resolve({ slug: "loja" }),
    searchParams: Promise.resolve({ pagina: "3" }),
  });

describe("catalog page past the last page", () => {
  beforeEach(() => {
    vi.mocked(getStore).mockResolvedValue(store);
  });

  it("goes back to the first page when the API sent no items for that page", async () => {
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 0,
      total: 30,
      page: 3,
      pageSize: 24,
    });
    await expect(render()).rejects.toThrow(/^redirect:\/store\/loja$/);
  });

  it("stays on the page when every item the API sent was dropped", async () => {
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 6,
      total: 30,
      page: 3,
      pageSize: 24,
    });
    await expect(render()).resolves.toBeTruthy();
  });

  it("renders the first page even when it has no items, instead of redirecting to itself", async () => {
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 0,
      total: 30,
      page: 1,
      pageSize: 24,
    });
    await expect(
      CatalogPage({
        params: Promise.resolve({ slug: "loja" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });
});
