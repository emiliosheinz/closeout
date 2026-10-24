import Link from "next/link";
import { type CatalogFilters, catalogHref } from "@/lib/catalog/params";

export function Pagination({
  storeSlug,
  filters,
  total,
  pageSize,
}: {
  storeSlug: string;
  filters: CatalogFilters;
  total: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link =
    "inline-flex h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-semibold hover:border-ink/40";
  return (
    <nav
      aria-label="Paginação"
      className="mt-12 flex items-center justify-between gap-4"
    >
      {filters.page > 1 ? (
        <Link
          href={catalogHref(storeSlug, { ...filters, page: filters.page - 1 })}
          className={link}
          rel="prev"
        >
          Anteriores
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted">
        Página {filters.page} de {pages}
      </p>
      {filters.page < pages ? (
        <Link
          href={catalogHref(storeSlug, { ...filters, page: filters.page + 1 })}
          className={link}
          rel="next"
        >
          Ver mais itens
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
