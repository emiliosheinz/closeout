import Link from "next/link";
import type { CatalogFilters, StoreInfo } from "@/entities/listing";
import { cn } from "@/shared/lib/utils";
import { catalogHref, withFilters } from "../model/params";

/** Horizontal category strip; each chip is a plain link. */
export function CategoryChips({
  storeSlug,
  categories,
  filters,
}: {
  storeSlug: string;
  categories: StoreInfo["categories"];
  filters: CatalogFilters;
}) {
  const visible = categories.filter(
    (category) => category.count > 0 || category.slug === filters.category,
  );
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap",
      active
        ? "bg-ink text-surface"
        : "border border-line bg-surface text-ink hover:border-ink/40",
    );
  return (
    <nav
      aria-label="Categorias"
      className="-mx-4 -my-1.5 overflow-x-auto px-4 py-1.5 scrollbar-none sm:-mx-1.5 sm:px-1.5"
    >
      <ul className="flex gap-2">
        <li>
          <Link
            href={catalogHref(
              storeSlug,
              withFilters(filters, { category: null }),
            )}
            className={chip(filters.category === null)}
            aria-current={filters.category === null ? "page" : undefined}
          >
            Tudo
          </Link>
        </li>
        {visible.map((category) => {
          const active = filters.category === category.slug;
          return (
            <li key={category.slug}>
              <Link
                href={catalogHref(
                  storeSlug,
                  withFilters(filters, { category: category.slug }),
                )}
                className={chip(active)}
                aria-current={active ? "page" : undefined}
              >
                {category.name}
                <span className={active ? "text-surface/70" : "text-muted"}>
                  {category.count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
