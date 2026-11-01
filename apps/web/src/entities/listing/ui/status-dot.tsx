import type { Availability, Publication } from "@closeout/contracts/enums";
import { cn } from "@/shared/lib/utils";

const DOT_COLORS: Record<Publication | Availability, string> = {
  published: "bg-go",
  draft: "bg-line-strong",
  archived: "bg-line-strong",
  available: "bg-go",
  reserved: "bg-hold",
  sold: "bg-ink",
};

/** A colored dot per status, so a column of statuses reads at a glance. */
export function StatusDot({ status }: { status: Publication | Availability }) {
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", DOT_COLORS[status])}
      aria-hidden="true"
    />
  );
}
