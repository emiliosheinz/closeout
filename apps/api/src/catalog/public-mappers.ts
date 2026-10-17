import { type ImageUrls, mediaUrls } from "@/media/media-urls";
import type { Listing } from "./entities/listing.entity";
import type { ListingImage } from "./entities/listing-image.entity";
import { canContact } from "./listing-rules";
import type {
  Availability,
  Condition,
  ListingAttribute,
} from "./listing-types";

/*
 * Public payloads are assembled field by field from an allow-list. Entities
 * are never serialized directly, so publication state, storage keys, user
 * ids and timestamps of drafts cannot leak by accident.
 */

export interface PublicImage extends ImageUrls {
  width: number;
  height: number;
}

export interface PublicListingSummary {
  slug: string;
  title: string;
  priceCents: number | null;
  condition: Condition;
  availability: Availability;
  category: { slug: string; name: string };
  cover: PublicImage | null;
}

export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  attributes: ListingAttribute[];
  images: PublicImage[];
  seller: {
    name: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
  };
  canContact: boolean;
  publishedAt: string | null;
  updatedAt: string;
  related: PublicListingSummary[];
}

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

/** Expects `category`, `seller` and ordered `images` loaded. */
export function toPublicDetail(
  listing: Listing,
  related: PublicListingSummary[],
): PublicListingDetail {
  const contactable = canContact(listing, listing.seller);
  return {
    ...toPublicSummary(listing),
    description: listing.description,
    attributes: listing.attributes,
    images: listing.images.map(toPublicImage),
    seller: {
      name: listing.seller.displayName,
      avatarUrl: listing.seller.avatarKey
        ? mediaUrls(listing.seller.avatarKey).sm
        : null,
      // Withheld once the item cannot be bought, so a sold page carries no
      // contact data at all.
      whatsappNumber: contactable ? listing.seller.whatsappNumber : null,
    },
    canContact: contactable,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    updatedAt: listing.updatedAt.toISOString(),
    related,
  };
}
