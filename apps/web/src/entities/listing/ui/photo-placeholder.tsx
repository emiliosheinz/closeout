import { Package } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** Stands in for a listing without photos so no media area is ever empty. */
export function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div
      data-testid="photo-placeholder"
      className={cn(
        "flex size-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,transparent_0_14px,rgba(185,139,78,0.08)_14px_28px)] bg-tape/15 text-ink-soft",
        className,
      )}
    >
      <Package className="size-10" strokeWidth={1.5} aria-hidden="true" />
      <span className="text-sm font-medium">Sem foto por enquanto</span>
    </div>
  );
}
