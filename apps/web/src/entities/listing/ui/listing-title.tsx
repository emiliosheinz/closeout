import { ImageOff, PhoneOff } from "lucide-react";
import Link from "next/link";
import { joinNames } from "@/shared/lib/format";
import type { AdminListingSummary } from "../model/types";

/** A listing row's cover, title link, category and sellers. */
export function ListingTitle({
  listing,
  unreachableSellerIds = [],
}: {
  listing: AdminListingSummary;
  /** Sellers without a WhatsApp number; an item none of whose sellers has one shows no contact button. */
  unreachableSellerIds?: string[];
}) {
  const unreachable = listing.sellers.every((seller) =>
    unreachableSellerIds.includes(seller.id),
  );
  return (
    <div className="flex items-center gap-4">
      <div className="size-16 shrink-0 overflow-hidden rounded-md bg-paper">
        {listing.coverUrl ? (
          // biome-ignore lint/performance/noImgElement: small pre-sized variant.
          <img
            src={listing.coverUrl}
            alt=""
            width={64}
            height={64}
            className="size-full object-cover"
          />
        ) : (
          <span
            className="flex size-full items-center justify-center text-muted"
            title="Sem fotos"
          >
            <ImageOff className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <Link
          href={`/admin/listings/${listing.id}`}
          className="font-semibold hover:underline"
        >
          {listing.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted">
          {listing.category.name}, por{" "}
          {joinNames(listing.sellers.map((seller) => seller.displayName))}
        </p>
        {listing.publication === "published" &&
          listing.availability !== "sold" &&
          unreachable && (
            <Link
              href="/admin/team"
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-stamp/10 px-2.5 py-1 text-xs font-semibold text-stamp hover:bg-stamp/15"
              title="Este item aparece na loja sem botão de contato."
            >
              <PhoneOff className="size-3.5" aria-hidden="true" />
              Vendedor sem WhatsApp
            </Link>
          )}
      </div>
    </div>
  );
}
