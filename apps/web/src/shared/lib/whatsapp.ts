import { whatsappDigitsSchema } from "@closeout/contracts/schemas";

const isStoredNumber = (value: string) =>
  whatsappDigitsSchema.safeParse(value).success;

/** Pre-filled, editable first message a buyer sends about a listing. */
export function interestMessage(title: string, listingUrl: string): string {
  return `Oi! Tenho interesse no item "${title}" que vi no catálogo de vocês: ${listingUrl}. Ele ainda está disponível?`;
}

/**
 * `wa.me` click-to-chat link for a listing, or null when the number is not a
 * valid international number, so the UI never renders a link that opens a
 * chat with the wrong person or nobody.
 */
export function listingContactUrl(
  whatsappNumber: string | null,
  title: string,
  listingUrl: string,
): string | null {
  if (!whatsappNumber || !isStoredNumber(whatsappNumber)) return null;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    interestMessage(title, listingUrl),
  )}`;
}

/** General "hello" link for the storefront header. */
export function sellerContactUrl(
  whatsappNumber: string,
  storeName: string,
): string | null {
  if (!isStoredNumber(whatsappNumber)) return null;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Oi! Vi o catálogo "${storeName}" e queria tirar uma dúvida.`,
  )}`;
}

/** Plain `wa.me` chat link, or null when the number is not a stored number. */
export function chatUrl(whatsappNumber: string | null): string | null {
  if (!whatsappNumber || !isStoredNumber(whatsappNumber)) return null;
  return `https://wa.me/${whatsappNumber}`;
}

/**
 * Shows a stored digits-only number the way people write it: a Brazilian
 * number as "+55 11 98888-7777", any other as "+" and its digits. The form
 * fields accept it back as typed.
 */
export function displayNumber(number: string | null): string {
  if (!number) return "";
  const br = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(number);
  return br ? `+55 ${br[1]} ${br[2]}-${br[3]}` : `+${number}`;
}
