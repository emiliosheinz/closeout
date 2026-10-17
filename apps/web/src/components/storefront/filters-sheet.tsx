"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Compact entry point to the filter form on small screens. */
export function FiltersSheet({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold lg:hidden">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtros
        {activeCount > 0 && (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-ink text-xs text-surface">
            {activeCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="overflow-y-auto px-5 pt-6 pb-6">
        <SheetTitle className="text-xl font-bold">Filtrar itens</SheetTitle>
        <SheetDescription className="mt-1 mb-5 text-sm text-muted">
          Escolha o que importa e veja só o que combina.
        </SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}
