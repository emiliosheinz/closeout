import Link from "next/link";
import {
  type CatalogFilters,
  catalogHref,
  withFilters,
} from "@/lib/catalog/params";
import type { StoreInfo } from "@/lib/catalog/types";
import { cn } from "@/lib/utils";

/** Horizontal category strip; each chip is a plain link. */
export function CategoryChips({
  categories,
  filters,
}: {
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
      className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-2 py-1">
        <li>
          <Link
            href={catalogHref(withFilters(filters, { category: null }))}
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
