"use client";

import { CONDITIONS } from "@closeout/contracts/enums";
import Link from "next/link";
import type { CatalogFilters } from "@/entities/listing";
import { CONDITION_LABELS, SORT_LABELS } from "@/shared/lib/format";
import { storePath } from "@/shared/lib/site";
import { useLiveCatalogForm } from "../model/live-form";
import { CATALOG_SORTS, catalogEntries } from "../model/params";

function Choice({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface px-3.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        className="sr-only"
      />
      {label}
    </label>
  );
}

/**
 * Catalog filters as a GET form producing the same shareable URL as every
 * other catalog control. `live` applies each change as it is made (the
 * desktop sidebar); otherwise the visitor applies them with the button, which
 * stays in view at the bottom of a scrolling container (the mobile sheet).
 */
export function FilterForm({
  storeSlug,
  filters,
  live = false,
}: {
  storeSlug: string;
  filters: CatalogFilters;
  live?: boolean;
}) {
  const liveForm = useLiveCatalogForm(storeSlug, filters);
  return (
    <form
      action={storePath(storeSlug)}
      method="get"
      className="flex flex-col gap-6"
      {...(live && liveForm)}
    >
      {catalogEntries(filters, ["condition", "min", "max", "sort", "page"]).map(
        ([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ),
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Estado</legend>
        <div className="flex flex-wrap gap-2">
          <Choice
            name="condition"
            value=""
            label="Qualquer"
            checked={!filters.condition}
          />
          {CONDITIONS.map((condition) => (
            <Choice
              key={condition}
              name="condition"
              value={condition}
              label={CONDITION_LABELS[condition]}
              checked={filters.condition === condition}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Preço (R$)</legend>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">Preço mínimo em reais</span>
            <input
              type="number"
              name="min"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="Mínimo"
              defaultValue={filters.minPrice ?? ""}
              className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base placeholder:text-muted"
            />
          </label>
          <span aria-hidden="true" className="text-muted">
            até
          </span>
          <label className="flex-1">
            <span className="sr-only">Preço máximo em reais</span>
            <input
              type="number"
              name="max"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="Máximo"
              defaultValue={filters.maxPrice ?? ""}
              className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base placeholder:text-muted"
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Itens com preço a combinar saem da lista quando há faixa de preço.
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Ordenar por</legend>
        <div className="flex flex-wrap gap-2">
          {CATALOG_SORTS.map((sort) => (
            <Choice
              key={sort}
              name="sort"
              value={sort === "recent" ? "" : sort}
              label={SORT_LABELS[sort]}
              checked={filters.sort === sort}
            />
          ))}
        </div>
      </fieldset>

      <div
        className={
          live
            ? "flex items-center"
            : "sticky bottom-0 -mx-5 -mb-6 flex items-center gap-3 border-t border-line bg-surface px-5 py-4"
        }
      >
        {!live && (
          <button
            type="submit"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-surface hover:bg-ink-soft"
          >
            Aplicar filtros
          </button>
        )}
        <Link
          href={storePath(storeSlug)}
          className="inline-flex h-11 items-center px-3 text-sm font-medium underline decoration-ink/30 underline-offset-4"
        >
          Limpar tudo
        </Link>
      </div>
    </form>
  );
}
