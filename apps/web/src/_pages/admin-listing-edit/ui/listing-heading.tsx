"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { listingReads } from "@/entities/listing";
import { readQuery } from "@/shared/api";
import { itemPath } from "@/shared/lib/site";

export function ListingHeading({
  storeId,
  storeSlug,
  listingId,
}: {
  storeId: string;
  storeSlug: string;
  listingId: string;
}) {
  const { data: listing } = useSuspenseQuery(
    readQuery(listingReads.detail(storeId, listingId)),
  );
  const published = listing.publication === "published";

  return (
    <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-extrabold">{listing.title}</h1>
      <a
        href={
          published
            ? itemPath(storeSlug, listing.slug)
            : `/admin/listings/${listing.id}/preview`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold underline decoration-ink/30 underline-offset-4"
      >
        {published ? "Ver na loja" : "Pré-visualizar"}
      </a>
    </div>
  );
}
