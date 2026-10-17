import type { Availability, Publication } from "./listing-status";

interface ListingState {
  publication: Publication;
  availability: Availability;
}

/** Published listings are the only ones a visitor can open by URL. */
export function isPubliclyVisible(listing: Pick<ListingState, "publication">) {
  return listing.publication === "published";
}

/**
 * Visible listings that appear in the default catalog view. Sold items stay
 * reachable by link but leave the default browse.
 */
export function isListedByDefault(listing: ListingState): boolean {
  return isPubliclyVisible(listing) && listing.availability !== "sold";
}

/**
 * A visitor may start a conversation about a listing only while it can still
 * be bought and its seller has a number to reach. Reserved items stay
 * contactable so buyers can queue.
 */
export function canContact(
  listing: Pick<ListingState, "availability">,
  seller: { whatsappNumber: string | null },
): boolean {
  return listing.availability !== "sold" && seller.whatsappNumber !== null;
}

export const PUBLISH_REQUIRES_PHOTO =
  "Adicione ao menos uma foto antes de publicar.";

export function canPublish(imageCount: number): boolean {
  return imageCount > 0;
}
