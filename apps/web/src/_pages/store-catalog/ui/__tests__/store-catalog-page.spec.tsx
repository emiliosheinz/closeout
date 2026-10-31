/** @vitest-environment node */
import { renderToStaticMarkup } from "react-dom/server";
import { getListings, getStore } from "@/entities/listing/index.server";
import { CatalogPage, generateMetadata } from "../store-catalog-page";

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
    searchParams: Promise.resolve({ page: "3" }),
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

describe("catalog page link preview", () => {
  it("points the canonical and preview URL of the unfiltered catalog at the store", async () => {
    vi.mocked(getStore).mockResolvedValue(store);
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 0,
      total: 0,
      page: 1,
      pageSize: 24,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "loja" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe("/store/loja");
    expect(metadata.openGraph?.url).toBe("/store/loja");
  });
});

describe("catalog page footer", () => {
  it("offers to create a store after the store's own line", async () => {
    vi.mocked(getStore).mockResolvedValue(store);
    vi.mocked(getListings).mockResolvedValue({
      items: [],
      received: 0,
      total: 0,
      page: 1,
      pageSize: 24,
    });

    const html = renderToStaticMarkup(
      await CatalogPage({
        params: Promise.resolve({ slug: "loja-x" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const footer = html.slice(
      html.indexOf("<footer"),
      html.indexOf("</footer>"),
    );
    expect(footer.indexOf("Sem cadastro, sem carrinho")).toBeGreaterThan(-1);
    expect(
      footer.indexOf("Feito com closeout. Quer vender seus desapegos?"),
    ).toBeGreaterThan(footer.indexOf("Sem cadastro, sem carrinho"));
    expect(footer).toContain(
      'href="/waitlist?ref=loja-x&amp;src=catalog-footer"',
    );
    expect(footer).toMatch(/>Crie sua loja<\/a>/);
  });
});
