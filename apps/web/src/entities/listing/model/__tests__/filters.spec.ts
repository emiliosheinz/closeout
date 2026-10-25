import {
  activeFilterCount,
  DEFAULT_FILTERS,
  hasActiveFilters,
  toApiQuery,
} from "../filters";

describe("catalog filters", () => {
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

  it("counts a one-sided price range as an active filter", () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, minPrice: 10 })).toBe(1);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, maxPrice: 10 })).toBe(1);
  });

  it("treats a search term as an active filter", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "mesa" })).toBe(true);
  });
});
