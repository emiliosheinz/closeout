const INTERNATIONAL_DIGITS = /^[1-9][0-9]{7,14}$/;
const ALLOWED_CHARACTERS = /^\+[0-9\s().-]+$/;

/**
 * Normalize a phone number typed by an admin into the digits-only
 * international form `wa.me` expects (`+55 (11) 99999-8888` →
 * `5511999998888`). The leading `+` is required so a number without its
 * country code can never be stored. Returns null when the input is invalid.
 */
export function normalizeWhatsAppNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!ALLOWED_CHARACTERS.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return INTERNATIONAL_DIGITS.test(digits) ? digits : null;
}

export const WHATSAPP_NUMBER_PATTERN = INTERNATIONAL_DIGITS;
