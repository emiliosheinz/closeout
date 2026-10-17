import {
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
    expect(catalogHref(DEFAULT_FILTERS)).toBe("/");
    const href = catalogHref({
      ...DEFAULT_FILTERS,
      q: "mesa & cadeira",
      condition: "for_parts",
      sort: "price_desc",
      page: 2,
    });
    expect(href).toBe(
      "/?q=mesa+%26+cadeira&estado=conserto&ordem=maior-preco&pagina=2",
    );
    const params = Object.fromEntries(new URLSearchParams(href.slice(2)));
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
      catalogHref({
        ...DEFAULT_FILTERS,
        condition: "like_new",
        sort: "price_asc",
      }),
    ).toBe("/?estado=como-novo&ordem=menor-preco");
  });
});
