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
    await expect(render()).rejects.toThrow(/^redirect:/);
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

describe("catalog page URL", () => {
  const visit = (searchParams: Record<string, string | string[]>) =>
    CatalogPage({
      params: Promise.resolve({ slug: "loja" }),
      searchParams: Promise.resolve(searchParams),
    });

  beforeEach(() => {
    vi.mocked(getStore).mockResolvedValue(store);
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 0,
      total: 0,
      page: 1,
      pageSize: 24,
    });
  });

  it("drops the empty fields a filter form sends", async () => {
    await expect(
      visit({
        estado: "bom",
        disponibilidade: "",
        min: "",
        max: "",
        ordem: "menor-preco",
      }),
    ).rejects.toThrow("redirect:/store/loja?estado=bom&ordem=menor-preco");
  });

  it("replaces invalid values, repeated keys and unknown keys with the view they show", async () => {
    await expect(
      visit({ q: [" mesa ", "sofa"], min: "-5", ordem: "xyz", utm: "a" }),
    ).rejects.toThrow("redirect:/store/loja?q=mesa");
  });

  it("puts the parameters in their usual order", async () => {
    await expect(
      visit({ ordem: "menor-preco", categoria: "moveis" }),
    ).rejects.toThrow(
      "redirect:/store/loja?categoria=moveis&ordem=menor-preco",
    );
  });

  it("serves a clean URL without redirecting", async () => {
    await expect(
      visit({ q: "mesa azul", categoria: "moveis", ordem: "menor-preco" }),
    ).resolves.toBeTruthy();
    await expect(visit({})).resolves.toBeTruthy();
  });
});
