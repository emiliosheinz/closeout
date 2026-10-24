import { formatPrice, formatStickerPrice } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

interface PriceStickerProps {
  priceCents: number | null;
  size?: "md" | "lg";
  className?: string;
  /** Hide from assistive tech when the price is already written nearby. */
  decorative?: boolean;
}

/**
 * The round yellow garage-sale sticker, written in marker. The visual is
 * decorative; screen readers get the full formatted price.
 */
export function PriceSticker({
  priceCents,
  size = "md",
  className,
  decorative = false,
}: PriceStickerProps) {
  const label = formatStickerPrice(priceCents);
  const long = label.length > 8;
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex aspect-square shrink-0 -rotate-6 items-center justify-center rounded-full bg-sticker p-1.5 text-center font-marker leading-none whitespace-nowrap text-sticker-ink shadow-[0_1px_0_rgba(0,0,0,0.12),0_6px_14px_-6px_rgba(23,32,43,0.45)] ring-1 ring-black/5",
        size === "md" &&
          (long
            ? "size-[4.5rem] text-[0.78rem] sm:size-20 sm:text-[0.9rem]"
            : "size-[4.5rem] text-[0.95rem] sm:size-20 sm:text-[1.05rem]"),
        size === "lg" &&
          (long ? "size-28 text-base" : "size-28 text-[1.35rem]"),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={label === "A combinar" ? "whitespace-normal" : undefined}
      >
        {label}
      </span>
      {!decorative && (
        <span className="sr-only">{formatPrice(priceCents)}</span>
      )}
    </span>
  );
}
