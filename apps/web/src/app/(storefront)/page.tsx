import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  activeFilterCount,
  hasActiveFilters,
  parseCatalogParams,
} from "@/lib/catalog/params";
import { pluralize } from "@/lib/format";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const store = await getStore();
  if (!store) return {};
  const filtered = hasActiveFilters(parseCatalogParams(await searchParams));
  const description =
    store.intro.slice(0, 160) ||
    `${pluralize(store.counts.available, "item disponível", "itens disponíveis")}.`;
  const cover = (await getListings({ ...parseCatalogParams({}) }, 1)).items[0]
    ?.cover;
  return {
    title: store.name,
    description,
    alternates: { canonical: "/" },
    // Filtered views are for sharing, not for search results.
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
  const [store, page] = await Promise.all([getStore(), getListings(filters)]);
  if (!store) notFound();

  const filtered = hasActiveFilters(filters);
  return (
    <>
      <StoreHeader store={store} />
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
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2
                id="results-heading"
                className="text-sm font-medium text-ink-soft"
                aria-live="polite"
              >
                <span data-testid="results-count">
                  {pluralize(page.total, "item", "itens")}
                </span>
                {filters.q && <> para “{filters.q}”</>}
              </h2>
            </div>

            {page.items.length === 0 ? (
              <EmptyState filtered={filtered} />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
                {page.items.map((listing, index) => (
                  <li key={listing.slug}>
                    <ListingCard listing={listing} priority={index < 4} />
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              filters={filters}
              total={page.total}
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
