import type { AdminListingSummary, DashboardCounts } from "./types";

export interface StatusFilter {
  /** Value of the `status` URL parameter. */
  slug: string;
  label: string;
  count: keyof DashboardCounts;
  matches: (listing: AdminListingSummary) => boolean;
}

const published = (listing: AdminListingSummary) =>
  listing.publication === "published";

/**
 * The dashboard counts double as filters. Availability filters cover
 * published listings only, the same rule the counts follow.
 */
export const STATUS_FILTERS: StatusFilter[] = [
  {
    slug: "publicados",
    label: "Publicados",
    count: "published",
    matches: published,
  },
  {
    slug: "disponiveis",
    label: "Disponíveis",
    count: "available",
    matches: (l) => published(l) && l.availability === "available",
  },
  {
    slug: "reservados",
    label: "Reservados",
    count: "reserved",
    matches: (l) => published(l) && l.availability === "reserved",
  },
  {
    slug: "vendidos",
    label: "Vendidos",
    count: "sold",
    matches: (l) => published(l) && l.availability === "sold",
  },
  {
    slug: "rascunhos",
    label: "Rascunhos",
    count: "draft",
    matches: (l) => l.publication === "draft",
  },
  {
    slug: "arquivados",
    label: "Arquivados",
    count: "archived",
    matches: (l) => l.publication === "archived",
  },
];

/** How many of the listings each status filter matches. */
export function tabCounts(listings: AdminListingSummary[]): DashboardCounts {
  const counts: DashboardCounts = {
    published: 0,
    available: 0,
    reserved: 0,
    sold: 0,
    draft: 0,
    archived: 0,
  };
  for (const filter of STATUS_FILTERS) {
    counts[filter.count] = listings.filter(filter.matches).length;
  }
  return counts;
}

/** Unknown or missing values mean "every listing". */
export function findStatusFilter(slug: string | undefined) {
  return STATUS_FILTERS.find((filter) => filter.slug === slug) ?? null;
}
