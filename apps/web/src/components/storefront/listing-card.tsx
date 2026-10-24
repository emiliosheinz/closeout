import Link from "next/link";
import type { ListingSummary } from "@/entities/listing";
import { CONDITION_LABELS } from "@/shared/lib/format";
import { itemPath } from "@/shared/lib/site";
import { cn } from "@/shared/lib/utils";
import { PhotoPlaceholder } from "./photo-placeholder";
import { PriceSticker } from "./price-sticker";
import { StatusStamp } from "./status-stamp";

export function ListingCard({
  storeSlug,
  listing,
  priority = false,
  fetchPriority,
}: {
  storeSlug: string;
  listing: ListingSummary;
  priority?: boolean;
  fetchPriority?: "high";
}) {
  const sold = listing.availability === "sold";
  return (
    <article className="group relative min-w-0 rounded-lg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-focus">
      <div className="relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-surface ring-1 ring-line">
          {listing.cover ? (
            // biome-ignore lint/performance/noImgElement: variants are pre-sized by the API; next/image would re-encode them.
            <img
              src={listing.cover.sm}
              srcSet={`${listing.cover.sm} 640w, ${listing.cover.lg} 1600w`}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 31vw, 48vw"
              width={listing.cover.width}
              height={listing.cover.height}
              alt={`Foto de ${listing.title}`}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={fetchPriority}
              decoding="async"
              className={cn(
                "size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
                sold && "grayscale",
              )}
            />
          ) : (
            <PhotoPlaceholder />
          )}
          <StatusStamp
            availability={listing.availability}
            className="absolute top-3 right-3"
          />
        </div>
        <PriceSticker
          priceCents={listing.priceCents}
          className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3"
        />
      </div>
      <div className="mt-3">
        <h3 className="text-[0.95rem] leading-snug font-semibold text-pretty break-words">
          <Link
            href={itemPath(storeSlug, listing.slug)}
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none group-has-[:focus-visible]:underline"
          >
            {listing.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-muted">
          {CONDITION_LABELS[listing.condition]}
        </p>
      </div>
    </article>
  );
}
