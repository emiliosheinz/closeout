import type { Condition } from "@closeout/contracts/enums";

export type CatalogSort = "recent" | "price_asc" | "price_desc";

export interface CatalogFilters {
  q: string;
  category: string | null;
  condition: Condition | null;
  /** Whole reais. */
  minPrice: number | null;
  /** Whole reais. */
  maxPrice: number | null;
  sort: CatalogSort;
  page: number;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  category: null,
  condition: null,
  minPrice: null,
  maxPrice: null,
  sort: "recent",
  page: 1,
};

/**
 * Query for the public listings endpoint, with prices converted to cents.
 * The endpoint lists available items unless `all` asks for every published one.
 */
export function toApiQuery(
  filters: CatalogFilters,
  pageSize: number,
  availability?: "all",
): URLSearchParams {
  const params = new URLSearchParams({
    sort: filters.sort,
    page: String(filters.page),
    pageSize: String(pageSize),
  });
  if (availability) params.set("availability", availability);
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.minPrice !== null) {
    params.set("minPrice", String(filters.minPrice * 100));
  }
  if (filters.maxPrice !== null) {
    params.set("maxPrice", String(filters.maxPrice * 100));
  }
  return params;
}

/** Filters a visitor set beyond search and sort, for the "Filtros (n)" badge. */
export function activeFilterCount(filters: CatalogFilters): number {
  return [
    filters.category !== null,
    filters.condition !== null,
    filters.minPrice !== null || filters.maxPrice !== null,
  ].filter(Boolean).length;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.q !== "";
}
