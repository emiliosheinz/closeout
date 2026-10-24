import { Search } from "lucide-react";
import { type CatalogFilters, catalogEntries } from "@/lib/catalog/params";
import { storePath } from "@/lib/site";

/** GET search that keeps the other active filters. */
export function SearchForm({
  storeSlug,
  filters,
}: {
  storeSlug: string;
  filters: CatalogFilters;
}) {
  return (
    <search className="relative min-w-0 flex-1">
      <form action={storePath(storeSlug)} method="get">
        <label htmlFor="catalog-search" className="sr-only">
          Buscar itens
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          id="catalog-search"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Buscar sofá, cadeira, panela..."
          enterKeyHint="search"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-line-strong bg-surface pr-4 pl-12 text-base shadow-[0_1px_0_rgba(23,32,43,0.04)] placeholder:text-muted"
        />
        {catalogEntries(filters, ["q", "pagina"]).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
    </search>
  );
}
