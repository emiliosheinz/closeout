import { X } from "lucide-react";
import Link from "next/link";
import type { FilterChip } from "@/lib/catalog/params";
import { storePath } from "@/lib/site";

/** What the visitor is looking at, with one tap to undo each part. */
export function ActiveFilters({
  storeSlug,
  chips,
}: {
  storeSlug: string;
  chips: FilterChip[];
}) {
  if (chips.length === 0) return null;
  return (
    <ul
      className="flex flex-wrap items-center gap-2"
      aria-label="Filtros ativos"
    >
      {chips.map((chip) => (
        <li key={chip.href}>
          <Link
            href={chip.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink/5 pr-2.5 pl-3.5 text-sm font-medium hover:bg-ink/10"
            aria-label={`Remover filtro ${chip.label}`}
          >
            {chip.label}
            <X className="size-3.5" aria-hidden="true" />
          </Link>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <Link
            href={storePath(storeSlug)}
            className="inline-flex h-9 items-center px-2 text-sm font-medium underline decoration-ink/30 underline-offset-4"
          >
            Limpar filtros
          </Link>
        </li>
      )}
    </ul>
  );
}
