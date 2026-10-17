import { randomBytes } from "node:crypto";

const MAX_BASE_LENGTH = 60;
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * URL slug for a listing: readable title part plus a random suffix, so two
 * listings with the same title never collide and the slug never has to
 * change when the title does.
 */
export function listingSlug(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, "");
  const suffix = Array.from(
    randomBytes(6),
    (byte) => SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length],
  ).join("");
  return base ? `${base}-${suffix}` : `item-${suffix}`;
}
