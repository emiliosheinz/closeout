import {
  AVAILABILITY_FILTER_LABELS,
  CONDITION_LABELS,
  formatStickerPrice,
} from "../format";
import type { Condition } from "./types";

/*
 * Catalog state lives in the URL so a filtered view can be shared and the
 * back button works. Parameter names and values are Portuguese because
 * visitors read and share these links.
 */

export type AvailabilityFilter =
  | "listed"
  | "available"
  | "reserved"
  | "sold"
  | "all";
export type CatalogSort = "recent" | "price_asc" | "price_desc";

export interface CatalogFilters {
  q: string;
  category: string | null;
  condition: Condition | null;
  availability: AvailabilityFilter;
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
  availability: "listed",
  minPrice: null,
  maxPrice: null,
  sort: "recent",
  page: 1,
};

const CONDITION_SLUGS: Record<string, Condition> = {
  novo: "new",
  "como-novo": "like_new",
  bom: "good",
  "marcas-de-uso": "fair",
  conserto: "for_parts",
};
const AVAILABILITY_SLUGS: Record<string, AvailabilityFilter> = {
  disponivel: "available",
  reservado: "reserved",
  vendido: "sold",
  todos: "all",
};
const SORT_SLUGS: Record<string, CatalogSort> = {
  recentes: "recent",
  "menor-preco": "price_asc",
  "maior-preco": "price_desc",
};
const CATEGORY_PATTERN = /^[a-z0-9-]{1,60}$/;
const MAX_PAGE = 1000;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function wholeNumber(value: string | undefined, max: number): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= max ? parsed : null;
}

/** Read the URL; anything invalid falls back to its default instead of erroring. */
export function parseCatalogParams(params: RawParams): CatalogFilters {
  const category = first(params.categoria);
  let minPrice = wholeNumber(first(params.min), 1_000_000);
  let maxPrice = wholeNumber(first(params.max), 1_000_000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    category: category && CATEGORY_PATTERN.test(category) ? category : null,
    condition: CONDITION_SLUGS[first(params.estado) ?? ""] ?? null,
    availability:
      AVAILABILITY_SLUGS[first(params.disponibilidade) ?? ""] ?? "listed",
    minPrice,
    maxPrice,
    sort: SORT_SLUGS[first(params.ordem) ?? ""] ?? "recent",
    page: wholeNumber(first(params.pagina), MAX_PAGE) || 1,
  };
}

export type CatalogParam =
  | "q"
  | "categoria"
  | "estado"
  | "disponibilidade"
  | "min"
  | "max"
  | "ordem"
  | "pagina";

/**
 * The URL parameters for `filters`, defaults omitted. The single source for
 * both links and the hidden fields of the plain GET forms.
 */
export function catalogEntries(
  filters: CatalogFilters,
  omit: CatalogParam[] = [],
): [CatalogParam, string][] {
  const entries: [CatalogParam, string | null][] = [
    ["q", filters.q || null],
    ["categoria", filters.category],
    ["estado", filters.condition && CONDITION_PARAM[filters.condition]],
    [
      "disponibilidade",
      filters.availability === "listed"
        ? null
        : AVAILABILITY_PARAM[filters.availability],
    ],
    ["min", filters.minPrice === null ? null : String(filters.minPrice)],
    ["max", filters.maxPrice === null ? null : String(filters.maxPrice)],
    ["ordem", filters.sort === "recent" ? null : SORT_PARAM[filters.sort]],
    ["pagina", filters.page > 1 ? String(filters.page) : null],
  ];
  return entries.filter(
    (entry): entry is [CatalogParam, string] =>
      entry[1] !== null && !omit.includes(entry[0]),
  );
}

/** Catalog URL for `filters`, omitting defaults so links stay short. */
export function catalogHref(filters: CatalogFilters): string {
  const query = new URLSearchParams(catalogEntries(filters)).toString();
  return query ? `/?${query}` : "/";
}

/** Apply a change; any change other than the page itself returns to page 1. */
export function withFilters(
  filters: CatalogFilters,
  patch: Partial<CatalogFilters>,
): CatalogFilters {
  return { ...filters, page: 1, ...patch };
}

/** Query for the public listings endpoint, with prices converted to cents. */
export function toApiQuery(
  filters: CatalogFilters,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams({
    sort: filters.sort,
    page: String(filters.page),
    pageSize: String(pageSize),
    availability: filters.availability,
  });
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
    filters.availability !== "listed",
    filters.minPrice !== null || filters.maxPrice !== null,
  ].filter(Boolean).length;
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.q !== "";
}

export interface FilterChip {
  label: string;
  /** The current view without this filter. */
  href: string;
}

/** One removable chip per active filter, in the order the controls show them. */
export function activeFilterChips(
  filters: CatalogFilters,
  categoryName: (slug: string) => string | undefined,
): FilterChip[] {
  // The sticker format would print a zero bound as "Grátis".
  const reais = (value: number) =>
    value === 0 ? "R$ 0" : formatStickerPrice(value * 100);
  const { minPrice, maxPrice } = filters;
  const price =
    minPrice !== null && maxPrice !== null
      ? `${reais(minPrice)} a ${reais(maxPrice)}`
      : maxPrice !== null
        ? `Até ${reais(maxPrice)}`
        : minPrice !== null
          ? `A partir de ${reais(minPrice)}`
          : null;
  const chips: [string | null, Partial<CatalogFilters>][] = [
    [filters.q ? `“${filters.q}”` : null, { q: "" }],
    [
      filters.category && (categoryName(filters.category) ?? filters.category),
      { category: null },
    ],
    [
      filters.condition && CONDITION_LABELS[filters.condition],
      { condition: null },
    ],
    [
      filters.availability === "listed"
        ? null
        : AVAILABILITY_FILTER_LABELS[filters.availability],
      { availability: "listed" },
    ],
    [price, { minPrice: null, maxPrice: null }],
  ];
  return chips.flatMap(([label, patch]) =>
    label ? [{ label, href: catalogHref(withFilters(filters, patch)) }] : [],
  );
}

/** URL value for each option, used by plain GET forms. */
export const CONDITION_PARAM: Record<Condition, string> =
  invert(CONDITION_SLUGS);
export const AVAILABILITY_PARAM = invert(AVAILABILITY_SLUGS);
export const SORT_PARAM = invert(SORT_SLUGS);

function invert<T extends string>(map: Record<string, T>): Record<T, string> {
  return Object.fromEntries(
    Object.entries(map).map(([slug, value]) => [value, slug]),
  ) as Record<T, string>;
}
