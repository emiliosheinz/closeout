import type {
  PublicImage,
  PublicListingDetail,
  PublicListingSummary,
} from "@closeout/contracts/schemas";
import { mediaUrls } from "@/media/media-urls";
import type { Seller } from "@/sellers/entities/seller.entity";
import type { Listing } from "./entities/listing.entity";
import type { ListingImage } from "./entities/listing-image.entity";
import { canContact } from "./listing-rules";

/*
 * Public payloads are assembled field by field from an allow-list. Entities
 * are never serialized directly, so publication state, storage keys, user
 * ids and timestamps of drafts cannot leak by accident.
 */

export function toPublicImage(image: ListingImage): PublicImage {
  return {
    ...mediaUrls(image.storageKey),
    width: image.width,
    height: image.height,
  };
}

/** Expects `category` loaded and `images` ordered with the cover first. */
export function toPublicSummary(
  listing: Listing,
  cover: ListingImage | undefined = listing.images?.[0],
): PublicListingSummary {
  return {
    slug: listing.slug,
    title: listing.title,
    priceCents: listing.priceCents,
    condition: listing.condition,
    availability: listing.availability,
    category: { slug: listing.category.slug, name: listing.category.name },
    cover: cover ? toPublicImage(cover) : null,
  };
}

/** A listing's sellers, alphabetical so every page lists them the same way. */
export function listingSellers(listing: Listing): Seller[] {
  return listing.sellers
    .map((row) => row.seller)
    .sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
}

/** Expects `category`, `sellers.seller` and ordered `images` loaded. */
export function toPublicDetail(
  listing: Listing,
  related: PublicListingSummary[],
): PublicListingDetail {
  const sellers = listingSellers(listing);
  const contactable = canContact(listing, sellers);
  return {
    ...toPublicSummary(listing),
    description: listing.description,
    attributes: listing.attributes,
    images: listing.images.map(toPublicImage),
    sellers: sellers.map((seller) => ({
      name: seller.displayName,
      avatarUrl: seller.avatarKey ? mediaUrls(seller.avatarKey).sm : null,
      // Withheld once the item cannot be bought, so a sold page carries no
      // contact data at all.
      whatsappNumber: contactable ? seller.whatsappNumber : null,
    })),
    canContact: contactable,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    updatedAt: listing.updatedAt.toISOString(),
    related,
  };
}
