import { CONDITIONS } from "@closeout/contracts/enums";
import type {
  AvailabilityFilter,
  CatalogFilters,
  CatalogSort,
} from "@/entities/listing";
import {
  AVAILABILITY_FILTER_LABELS,
  CONDITION_LABELS,
  formatStickerPrice,
} from "@/shared/lib/format";
import { storePath } from "@/shared/lib/site";

/*
 * Catalog state lives in the URL so a filtered view can be shared and the
 * back button works. Parameter names are English; option values reuse the
 * enum values verbatim.
 */

/** Every availability filter, in the order the filter form shows them. */
export const AVAILABILITY_FILTERS: readonly AvailabilityFilter[] = [
  "listed",
  "available",
  "reserved",
  "sold",
  "all",
];
/** Every catalog sort, in the order the filter form shows them. */
export const CATALOG_SORTS: readonly CatalogSort[] = [
  "recent",
  "price_asc",
  "price_desc",
];
const CATEGORY_PATTERN = /^[a-z0-9-]{1,60}$/;
const MAX_PAGE = 1000;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(
  options: readonly T[],
  value: string | undefined,
): T | null {
  return options.find((option) => option === value) ?? null;
}

function wholeNumber(value: string | undefined, max: number): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= max ? parsed : null;
}

/** Read the URL; anything invalid falls back to its default instead of erroring. */
export function parseCatalogParams(params: RawParams): CatalogFilters {
  const category = first(params.category);
  let minPrice = wholeNumber(first(params.min), 1_000_000);
  let maxPrice = wholeNumber(first(params.max), 1_000_000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  return {
    q: (first(params.q) ?? "").trim().slice(0, 100),
    category: category && CATEGORY_PATTERN.test(category) ? category : null,
    condition: oneOf(CONDITIONS, first(params.condition)),
    availability:
      oneOf(AVAILABILITY_FILTERS, first(params.availability)) ?? "listed",
    minPrice,
    maxPrice,
    sort: oneOf(CATALOG_SORTS, first(params.sort)) ?? "recent",
    page: wholeNumber(first(params.page), MAX_PAGE) || 1,
  };
}

export type CatalogParam =
  | "q"
  | "category"
  | "condition"
  | "availability"
  | "min"
  | "max"
  | "sort"
  | "page";

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
    ["category", filters.category],
    ["condition", filters.condition],
    [
      "availability",
      filters.availability === "listed" ? null : filters.availability,
    ],
    ["min", filters.minPrice === null ? null : String(filters.minPrice)],
    ["max", filters.maxPrice === null ? null : String(filters.maxPrice)],
    ["sort", filters.sort === "recent" ? null : filters.sort],
    ["page", filters.page > 1 ? String(filters.page) : null],
  ];
  return entries.filter(
    (entry): entry is [CatalogParam, string] =>
      entry[1] !== null && !omit.includes(entry[0]),
  );
}

/** Catalog URL of store `slug` for `filters`, omitting defaults so links stay short. */
export function catalogHref(slug: string, filters: CatalogFilters): string {
  const query = new URLSearchParams(catalogEntries(filters)).toString();
  return query ? `${storePath(slug)}?${query}` : storePath(slug);
}

/**
 * The clean query for a catalog request, or null when `search` already is it.
 * A plain GET form also sends its empty fields, and a hand-edited URL can
 * carry invalid values, repeats or other keys; redirecting to the clean query
 * gives every view one address to share.
 */
export function canonicalCatalogSearch(search: URLSearchParams): string | null {
  const raw: RawParams = {};
  for (const key of search.keys()) raw[key] = search.getAll(key);
  const canonical = new URLSearchParams(
    catalogEntries(parseCatalogParams(raw)),
  ).toString();
  return canonical === search.toString() ? null : canonical;
}

/** Apply a change; any change other than the page itself returns to page 1. */
export function withFilters(
  filters: CatalogFilters,
  patch: Partial<CatalogFilters>,
): CatalogFilters {
  return { ...filters, page: 1, ...patch };
}

export interface FilterChip {
  label: string;
  /** The current view without this filter. */
  href: string;
}

/** One removable chip per active filter, in the order the controls show them. */
export function activeFilterChips(
  slug: string,
  filters: CatalogFilters,
  categoryName: (categorySlug: string) => string | undefined,
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
    label
      ? [{ label, href: catalogHref(slug, withFilters(filters, patch)) }]
      : [],
  );
}
