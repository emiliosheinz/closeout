import type {
  Availability,
  Publication,
  StoreRole,
} from "@closeout/contracts/enums";
import { isManager } from "@/stores/roles";

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

interface ListingActor {
  role: StoreRole;
  /** The actor's own contact profile. */
  sellerId: string;
}

/**
 * Who sells a new listing. Managers choose; a seller always sells their own
 * listing alone, whatever they submitted. Null when a manager chose nobody.
 */
export function sellersForNewListing(
  actor: ListingActor,
  submitted: string[] | undefined,
): string[] | null {
  if (!isManager(actor.role)) return [actor.sellerId];
  return submitted && submitted.length > 0 ? submitted : null;
}

/**
 * Whether an edit may set `submitted` (undefined leaves them unchanged) as a
 * listing's sellers. Only managers may change who sells a listing; order is
 * not a change.
 */
export function canSetSellers(
  actor: ListingActor,
  current: string[],
  submitted: string[] | undefined,
): boolean {
  if (isManager(actor.role) || submitted === undefined) return true;
  const wanted = new Set(submitted);
  return (
    wanted.size === current.length && current.every((id) => wanted.has(id))
  );
}
