import { DEFAULT_FILTERS } from "@/entities/listing";
import {
  activeFilterChips,
  canonicalCatalogSearch,
  catalogHref,
  parseCatalogParams,
  withFilters,
} from "../params";
import golden from "./fixtures/golden.json";

describe("catalog URL parameters", () => {
  it("reads every filter from English parameters", () => {
    expect(
      parseCatalogParams({
        q: " sofá ",
        category: "moveis",
        condition: "like_new",
        availability: "sold",
        min: "100",
        max: "500",
        sort: "price_asc",
        page: "3",
      }),
    ).toEqual({
      q: "sofá",
      category: "moveis",
      condition: "like_new",
      availability: "sold",
      minPrice: 100,
      maxPrice: 500,
      sort: "price_asc",
      page: 3,
    });
  });

  it("falls back to defaults for invalid values instead of failing", () => {
    expect(
      parseCatalogParams({
        category: "../etc",
        condition: "quebrado",
        availability: "talvez",
        min: "-5",
        max: "abc",
        sort: "aleatorio",
        page: "0",
      }),
    ).toEqual({
      q: "",
      category: null,
      condition: null,
      availability: "listed",
      minPrice: null,
      maxPrice: null,
      sort: "recent",
      page: 1,
    });
    expect(parseCatalogParams({ page: "99999" }).page).toBe(1);
  });

  it("ignores a kebab-case condition", () => {
    expect(parseCatalogParams({ condition: "like-new" }).condition).toBeNull();
  });

  it("builds the exact URL for a fully filtered view", () => {
    expect(
      catalogHref("s", {
        ...DEFAULT_FILTERS,
        category: "cozinha",
        condition: "like_new",
        availability: "sold",
        minPrice: 10,
        maxPrice: 50,
        sort: "price_desc",
        page: 2,
      }),
    ).toBe(
      "/store/s?category=cozinha&condition=like_new&availability=sold&min=10&max=50&sort=price_desc&page=2",
    );
  });

  it("swaps an inverted price range", () => {
    const filters = parseCatalogParams({ min: "500", max: "100" });
    expect([filters.minPrice, filters.maxPrice]).toEqual([100, 500]);
  });

  it("round-trips through the URL and omits defaults", () => {
    expect(catalogHref("nosso-desapego", DEFAULT_FILTERS)).toBe(
      "/store/nosso-desapego",
    );
    const href = catalogHref("nosso-desapego", {
      ...DEFAULT_FILTERS,
      q: "mesa & cadeira",
      condition: "for_parts",
      sort: "price_desc",
      page: 2,
    });
    expect(href).toBe(
      "/store/nosso-desapego?q=mesa+%26+cadeira&condition=for_parts&sort=price_desc&page=2",
    );
    const params = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(parseCatalogParams(params)).toMatchObject({
      q: "mesa & cadeira",
      condition: "for_parts",
      sort: "price_desc",
      page: 2,
    });
  });

  it("returns to the first page when a filter changes", () => {
    const onPage3 = { ...DEFAULT_FILTERS, page: 3 };
    expect(withFilters(onPage3, { category: "cozinha" }).page).toBe(1);
    expect(withFilters(onPage3, { page: 4 }).page).toBe(4);
  });
});

describe("catalog URL edge cases", () => {
  it("caps the search text at 100 characters", () => {
    expect(parseCatalogParams({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseCatalogParams({ q: ["a", "b"] }).q).toBe("a");
  });

  it("ignores prices above R$ 1.000.000", () => {
    expect(parseCatalogParams({ min: "1000000" }).minPrice).toBe(1000000);
    expect(parseCatalogParams({ min: "1000001" }).minPrice).toBeNull();
  });

  it("writes condition and sort slugs into the URL", () => {
    expect(
      catalogHref("loja-da-bia", {
        ...DEFAULT_FILTERS,
        condition: "like_new",
        sort: "price_asc",
      }),
    ).toBe("/store/loja-da-bia?condition=like_new&sort=price_asc");
  });

  it("offers one chip per active filter, each removing only itself", () => {
    const filters = parseCatalogParams({
      q: "mesa",
      category: "moveis",
      condition: "like_new",
      availability: "sold",
      max: "500",
      sort: "price_asc",
      page: "2",
    });
    expect(
      activeFilterChips("nosso-desapego", filters, (categorySlug) =>
        categorySlug === "moveis" ? "Móveis" : undefined,
      ),
    ).toEqual([
      {
        label: "“mesa”",
        href: "/store/nosso-desapego?category=moveis&condition=like_new&availability=sold&max=500&sort=price_asc",
      },
      {
        label: "Móveis",
        href: "/store/nosso-desapego?q=mesa&condition=like_new&availability=sold&max=500&sort=price_asc",
      },
      {
        label: "Como novo",
        href: "/store/nosso-desapego?q=mesa&category=moveis&availability=sold&max=500&sort=price_asc",
      },
      {
        label: "Vendidos",
        href: "/store/nosso-desapego?q=mesa&category=moveis&condition=like_new&max=500&sort=price_asc",
      },
      {
        label: "Até R$ 500",
        href: "/store/nosso-desapego?q=mesa&category=moveis&condition=like_new&availability=sold&sort=price_asc",
      },
    ]);
  });

  it("labels each shape of price range", () => {
    const label = (min?: string, max?: string) =>
      activeFilterChips(
        "loja",
        parseCatalogParams({ min, max }),
        () => undefined,
      )[0]?.label;
    expect(label("100", "1500")).toBe("R$ 100 a R$ 1.500");
    expect(label("100")).toBe("A partir de R$ 100");
    expect(label("0", "50")).toBe("R$ 0 a R$ 50");
    expect(activeFilterChips("loja", DEFAULT_FILTERS, () => undefined)).toEqual(
      [],
    );
  });
});

describe("clean catalog query", () => {
  const clean = (query: string) =>
    canonicalCatalogSearch(new URLSearchParams(query));

  it("drops the empty fields a filter form sends", () => {
    expect(clean("condition=good&availability=&min=&max=&sort=price_asc")).toBe(
      "condition=good&sort=price_asc",
    );
  });

  it("drops keys the catalog does not read", () => {
    expect(clean("q=mesa&utm=a")).toBe("q=mesa");
  });

  it("keeps only the first of a repeated key", () => {
    expect(clean("q=mesa&q=sofa")).toBe("q=mesa");
  });

  it("drops invalid values", () => {
    expect(clean("min=-5")).toBe("");
  });

  it("trims the search", () => {
    expect(clean("q=+mesa+")).toBe("q=mesa");
  });

  it("puts the parameters in their usual order", () => {
    expect(clean("sort=price_asc&category=moveis")).toBe(
      "category=moveis&sort=price_asc",
    );
  });

  it("leaves every URL the catalog itself links to as it is", () => {
    for (const row of golden) {
      const query = row.href.split("?")[1] ?? "";
      expect(clean(query)).toBeNull();
    }
  });
});
