import type { Condition } from "@closeout/contracts/enums";
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
 * back button works. Parameter names and values are Portuguese because
 * visitors read and share these links.
 */

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

/** Catalog URL of store `slug` for `filters`, omitting defaults so links stay short. */
export function catalogHref(slug: string, filters: CatalogFilters): string {
  const query = new URLSearchParams(catalogEntries(filters)).toString();
  return query ? `${storePath(slug)}?${query}` : storePath(slug);
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
