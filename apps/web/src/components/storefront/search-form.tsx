import { Search } from "lucide-react";
import {
  AVAILABILITY_PARAM,
  type CatalogFilters,
  CONDITION_PARAM,
  SORT_PARAM,
} from "@/lib/catalog/params";

/** GET search that keeps the other active filters. */
export function SearchForm({ filters }: { filters: CatalogFilters }) {
  return (
    <search className="relative min-w-0 flex-1">
      <form action="/" method="get">
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
          className="h-12 w-full rounded-full border border-line bg-surface pr-4 pl-12 text-base shadow-[0_1px_0_rgba(23,32,43,0.04)] placeholder:text-muted/80"
        />
        {filters.category && (
          <input type="hidden" name="categoria" value={filters.category} />
        )}
        {filters.condition && (
          <input
            type="hidden"
            name="estado"
            value={CONDITION_PARAM[filters.condition]}
          />
        )}
        {filters.availability !== "listed" && (
          <input
            type="hidden"
            name="disponibilidade"
            value={AVAILABILITY_PARAM[filters.availability]}
          />
        )}
        {filters.minPrice !== null && (
          <input type="hidden" name="min" value={filters.minPrice} />
        )}
        {filters.maxPrice !== null && (
          <input type="hidden" name="max" value={filters.maxPrice} />
        )}
        {filters.sort !== "recent" && (
          <input type="hidden" name="ordem" value={SORT_PARAM[filters.sort]} />
        )}
      </form>
    </search>
  );
}
