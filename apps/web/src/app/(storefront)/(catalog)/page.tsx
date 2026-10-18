import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActiveFilters } from "@/components/storefront/active-filters";
import { RememberCatalogView } from "@/components/storefront/catalog-return";
import { CategoryChips } from "@/components/storefront/category-chips";
import { EmptyState } from "@/components/storefront/empty-state";
import { FilterForm } from "@/components/storefront/filter-form";
import { FiltersSheet } from "@/components/storefront/filters-sheet";
import { ListingCard } from "@/components/storefront/listing-card";
import { Pagination } from "@/components/storefront/pagination";
import { SearchForm } from "@/components/storefront/search-form";
import { StoreHeader } from "@/components/storefront/store-header";
import { getListings, getStore, PAGE_SIZE } from "@/lib/catalog/api";
import {
  activeFilterChips,
  activeFilterCount,
  catalogHref,
  DEFAULT_FILTERS,
  hasActiveFilters,
  parseCatalogParams,
} from "@/lib/catalog/params";
import { pluralize } from "@/lib/format";
import { sellerContactUrl } from "@/lib/whatsapp";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const filters = parseCatalogParams(await searchParams);
  const [storeResult, coverResult] = await Promise.allSettled([
    getStore(),
    getListings({ ...parseCatalogParams({}) }, 1),
  ]);
  if (storeResult.status === "rejected") throw storeResult.reason;
  const store = storeResult.value;
  if (!store) return {};
  if (coverResult.status === "rejected") throw coverResult.reason;
  const filtered = hasActiveFilters(filters);
  const description =
    store.intro.slice(0, 160) ||
    `${pluralize(store.counts.available, "item disponível", "itens disponíveis")}.`;
  const cover = coverResult.value.items[0]?.cover;
  return {
    title: store.name,
    description,
    // Filtered views are for sharing, not for search results; plain pages
    // of the catalog are their own canonical.
    alternates: filtered
      ? undefined
      : { canonical: catalogHref({ ...DEFAULT_FILTERS, page: filters.page }) },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: store.name,
      title: store.headline || store.name,
      description,
      url: "/",
      images: cover ? [{ url: cover.og, width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary" },
  };
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const filters = parseCatalogParams(await searchParams);
  // getListings throws when the store is missing, so notFound must win over a
  // listings rejection: settle both and check the store first.
  const [storeResult, listingsResult] = await Promise.allSettled([
    getStore(),
    getListings(filters),
  ]);
  if (storeResult.status === "rejected") throw storeResult.reason;
  const store = storeResult.value;
  if (!store) notFound();
  if (listingsResult.status === "rejected") throw listingsResult.reason;
  const results = listingsResult.value;
  // A page past the end (old link, edited URL) shows the first page instead
  // of an empty catalog.
  if (results.items.length === 0 && results.total > 0 && filters.page > 1) {
    redirect(catalogHref({ ...filters, page: 1 }));
  }

  const filtered = hasActiveFilters(filters);
  const chips = activeFilterChips(
    filters,
    (slug) => store.categories.find((category) => category.slug === slug)?.name,
  );
  const contactHref =
    store.sellers
      .map((seller) => sellerContactUrl(seller.whatsappNumber, store.name))
      .find((href) => href !== null) ?? null;
  return (
    <>
      <RememberCatalogView href={catalogHref(filters)} />
      <StoreHeader store={store} compact={filtered || filters.page > 1} />
      <main
        id="catalogo"
        className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8"
      >
        <div className="sticky top-0 z-30 -mx-4 bg-paper/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2">
            <SearchForm filters={filters} />
            <FiltersSheet activeCount={activeFilterCount(filters)}>
              <FilterForm filters={filters} />
            </FiltersSheet>
          </div>
          <div className="mt-3">
            <CategoryChips categories={store.categories} filters={filters} />
          </div>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
          <aside className="hidden lg:block" aria-label="Filtros">
            <div className="sticky top-36">
              <FilterForm filters={filters} />
            </div>
          </aside>

          <section aria-labelledby="results-heading">
            <div className="mb-5 flex flex-col gap-3">
              <h2
                id="results-heading"
                className="text-sm font-medium text-ink-soft"
                aria-live="polite"
              >
                <span data-testid="results-count">
                  {pluralize(results.total, "item", "itens")}
                </span>
              </h2>
              <ActiveFilters chips={chips} />
            </div>

            {results.items.length === 0 ? (
              <EmptyState filtered={filtered} contactHref={contactHref} />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
                {results.items.map((listing, index) => (
                  <li key={listing.slug}>
                    <ListingCard
                      listing={listing}
                      priority={index < 4}
                      fetchPriority={index === 0 ? "high" : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              filters={filters}
              total={results.total}
              pageSize={PAGE_SIZE}
            />
          </section>
        </div>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-muted sm:px-6 lg:px-8">
        {store.name}. Sem cadastro, sem carrinho: viu algo, chama no WhatsApp.
      </footer>
    </>
  );
}
