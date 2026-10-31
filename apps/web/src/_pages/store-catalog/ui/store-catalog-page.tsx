import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  hasActiveFilters,
  ListingCard,
} from "@/entities/listing";
import {
  getListings,
  getStore,
  PAGE_SIZE,
} from "@/entities/listing/index.server";
import {
  ActiveFilters,
  activeFilterChips,
  CategoryChips,
  catalogHref,
  FilterForm,
  Pagination,
  parseCatalogParams,
  RememberCatalogView,
  SearchForm,
} from "@/features/catalog-filter";
import { pluralize } from "@/shared/lib/format";
import { storePath, waitlistPath } from "@/shared/lib/site";
import { sellerContactUrl } from "@/shared/lib/whatsapp";
import { EmptyState } from "./empty-state";
import { FiltersSheet } from "./filters-sheet";
import { StoreHeader } from "./store-header";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const filters = parseCatalogParams(await searchParams);
  const [storeResult, coverResult] = await Promise.allSettled([
    getStore(slug),
    getListings(slug, DEFAULT_FILTERS, 1),
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
      : {
          canonical: catalogHref(slug, {
            ...DEFAULT_FILTERS,
            page: filters.page,
          }),
        },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: store.name,
      title: store.headline || store.name,
      description,
      url: storePath(slug),
      images: cover ? [{ url: cover.og, width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary" },
  };
}

export async function CatalogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const filters = parseCatalogParams(await searchParams);
  // getListings throws when the store is missing, so notFound must win over a
  // listings rejection: settle both and check the store first.
  const [storeResult, listingsResult] = await Promise.allSettled([
    getStore(slug),
    getListings(slug, filters),
  ]);
  if (storeResult.status === "rejected") throw storeResult.reason;
  const store = storeResult.value;
  if (!store) notFound();
  if (listingsResult.status === "rejected") throw listingsResult.reason;
  const results = listingsResult.value;
  // A page past the end (old link, edited URL) shows the first page instead
  // of an empty catalog.
  if (results.received === 0 && results.total > 0 && filters.page > 1) {
    redirect(catalogHref(slug, { ...filters, page: 1 }));
  }

  const filtered = hasActiveFilters(filters);
  const chips = activeFilterChips(
    slug,
    filters,
    (categorySlug) =>
      store.categories.find((category) => category.slug === categorySlug)?.name,
  );
  const contactHref =
    store.sellers
      .map((seller) => sellerContactUrl(seller.whatsappNumber, store.name))
      .find((href) => href !== null) ?? null;
  return (
    <>
      <RememberCatalogView href={catalogHref(slug, filters)} />
      <StoreHeader store={store} compact={filtered || filters.page > 1} />
      <main
        id="catalogo"
        className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8"
      >
        <div className="sticky top-0 z-30 -mx-4 bg-paper/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2">
            <SearchForm storeSlug={slug} filters={filters} />
            <FiltersSheet activeCount={activeFilterCount(filters)}>
              <FilterForm storeSlug={slug} filters={filters} />
            </FiltersSheet>
          </div>
          <div className="mt-3">
            <CategoryChips
              storeSlug={slug}
              categories={store.categories}
              filters={filters}
            />
          </div>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
          <aside className="hidden lg:block" aria-label="Filtros">
            <div className="sticky top-36">
              <FilterForm storeSlug={slug} filters={filters} />
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
              <ActiveFilters storeSlug={slug} chips={chips} />
            </div>

            {results.items.length === 0 ? (
              <EmptyState
                storeSlug={slug}
                filtered={filtered}
                contactHref={contactHref}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
                {results.items.map((listing, index) => (
                  <li key={listing.slug}>
                    <ListingCard
                      storeSlug={slug}
                      listing={listing}
                      priority={index < 4}
                      fetchPriority={index === 0 ? "high" : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}

            <Pagination
              storeSlug={slug}
              filters={filters}
              total={results.total}
              pageSize={PAGE_SIZE}
            />
          </section>
        </div>
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-muted sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
          <p>
            {store.name}. Sem cadastro, sem carrinho: viu algo, chama no
            WhatsApp.
          </p>
          <p>
            Feito com closeout. Quer vender seus desapegos?{" "}
            <Link
              href={waitlistPath({ ref: slug, src: "catalog-footer" })}
              className="font-semibold whitespace-nowrap text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
            >
              Crie sua loja
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
