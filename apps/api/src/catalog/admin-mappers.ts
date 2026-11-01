import type {
  AdminImage,
  AdminListingSummary,
} from "@closeout/contracts/schemas";
import { mediaUrls } from "@/media/media-urls";
import type { Listing } from "./entities/listing.entity";
import type { ListingImage } from "./entities/listing-image.entity";

export function toAdminImage(image: ListingImage): AdminImage {
  const urls = mediaUrls(image.storageKey);
  return {
    id: image.id,
    position: image.position,
    width: image.width,
    height: image.height,
    urls: { sm: urls.sm, lg: urls.lg },
  };
}

/** Null when the listing has no buyer; the buyer relation must be loaded. */
export function toAdminSale(
  listing: Pick<Listing, "buyer" | "agreedPriceCents" | "paid" | "saleNotes">,
): NonNullable<AdminListingSummary["sale"]> | null {
  if (!listing.buyer) return null;
  return {
    buyer: { id: listing.buyer.id, name: listing.buyer.name },
    agreedPriceCents: listing.agreedPriceCents,
    paid: listing.paid,
    notes: listing.saleNotes,
  };
}
