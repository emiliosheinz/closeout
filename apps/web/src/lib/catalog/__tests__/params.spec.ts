import {
  activeFilterChips,
  activeFilterCount,
  catalogHref,
  DEFAULT_FILTERS,
  hasActiveFilters,
  parseCatalogParams,
  toApiQuery,
  withFilters,
} from "../params";

describe("catalog URL parameters", () => {
  it("reads every filter from Portuguese parameters", () => {
    expect(
      parseCatalogParams({
        q: " sofá ",
        categoria: "moveis",
        estado: "como-novo",
        disponibilidade: "vendido",
        min: "100",
        max: "500",
        ordem: "menor-preco",
        pagina: "3",
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
        categoria: "../etc",
        estado: "quebrado",
        disponibilidade: "talvez",
        min: "-5",
        max: "abc",
        ordem: "aleatorio",
        pagina: "0",
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
    expect(parseCatalogParams({ pagina: "99999" }).page).toBe(1);
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
      "/store/nosso-desapego?q=mesa+%26+cadeira&estado=conserto&ordem=maior-preco&pagina=2",
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

  it("sends prices to the API in cents", () => {
    const query = toApiQuery(
      { ...DEFAULT_FILTERS, minPrice: 50, maxPrice: 1200 },
      24,
    );
    expect(query.get("minPrice")).toBe("5000");
    expect(query.get("maxPrice")).toBe("120000");
    expect(query.get("availability")).toBe("listed");
  });

  it("counts active filters for the filter button badge", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        category: "moveis",
        minPrice: 10,
        maxPrice: 20,
        q: "x",
      }),
    ).toBe(2);
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

  it("counts a one-sided price range as an active filter", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, minPrice: 10 })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, maxPrice: 10 })).toBe(1);
  });

  it("treats a search term as an active filter", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "mesa" })).toBe(true);
  });

  it("writes condition and sort slugs into the URL", () => {
    expect(
      catalogHref("loja-da-bia", {
        ...DEFAULT_FILTERS,
        condition: "like_new",
        sort: "price_asc",
      }),
    ).toBe("/store/loja-da-bia?estado=como-novo&ordem=menor-preco");
  });

  it("offers one chip per active filter, each removing only itself", () => {
    const filters = parseCatalogParams({
      q: "mesa",
      categoria: "moveis",
      estado: "como-novo",
      disponibilidade: "vendido",
      max: "500",
      ordem: "menor-preco",
      pagina: "2",
    });
    expect(
      activeFilterChips("nosso-desapego", filters, (categorySlug) =>
        categorySlug === "moveis" ? "Móveis" : undefined,
      ),
    ).toEqual([
      {
        label: "“mesa”",
        href: "/store/nosso-desapego?categoria=moveis&estado=como-novo&disponibilidade=vendido&max=500&ordem=menor-preco",
      },
      {
        label: "Móveis",
        href: "/store/nosso-desapego?q=mesa&estado=como-novo&disponibilidade=vendido&max=500&ordem=menor-preco",
      },
      {
        label: "Como novo",
        href: "/store/nosso-desapego?q=mesa&categoria=moveis&disponibilidade=vendido&max=500&ordem=menor-preco",
      },
      {
        label: "Vendidos",
        href: "/store/nosso-desapego?q=mesa&categoria=moveis&estado=como-novo&max=500&ordem=menor-preco",
      },
      {
        label: "Até R$ 500",
        href: "/store/nosso-desapego?q=mesa&categoria=moveis&estado=como-novo&disponibilidade=vendido&ordem=menor-preco",
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
