import type { Availability } from "@/shared/config/enums";
import { AVAILABILITY_LABELS } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/** Rubber-stamp mark for items that are no longer simply available. */
export function StatusStamp({
  availability,
  className,
}: {
  availability: Availability;
  className?: string;
}) {
  if (availability === "available") return null;
  return (
    <span
      className={cn(
        "inline-block rotate-[-8deg] rounded-md border-[3px] border-double bg-surface/90 px-3 py-1 text-lg font-extrabold tracking-wide",
        availability === "sold"
          ? "border-stamp text-stamp"
          : "border-hold text-hold",
        className,
      )}
    >
      {AVAILABILITY_LABELS[availability]}
    </span>
  );
}
