import type { Availability, Publication } from "./listing-types";

/** Published listings are the only ones a visitor can open by URL. */
export function isPubliclyVisible(listing: { publication: Publication }) {
  return listing.publication === "published";
}

/**
 * A visitor may start a conversation about a listing only while it is
 * public, can still be bought, and at least one of its sellers has a number
 * to reach. Reserved items stay contactable so buyers can queue.
 */
export function canContact(
  listing: { publication: Publication; availability: Availability },
  sellers: { whatsappNumber: string | null }[],
): boolean {
  return (
    isPubliclyVisible(listing) &&
    listing.availability !== "sold" &&
    sellers.some((seller) => seller.whatsappNumber !== null)
  );
}

export const PUBLISH_REQUIRES_PHOTO =
  "Adicione ao menos uma foto antes de publicar.";

export function canPublish(imageCount: number): boolean {
  return imageCount > 0;
}

export const PUBLISHED_KEEPS_A_PHOTO =
  "Um anúncio publicado precisa de ao menos uma foto. Adicione outra antes de remover esta.";

/** A published listing must never be left without photos. */
export function canRemovePhoto(
  listing: { publication: Publication },
  imageCount: number,
): boolean {
  return !isPubliclyVisible(listing) || imageCount > 1;
}
