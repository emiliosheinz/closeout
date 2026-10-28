import { z } from "zod";

export const INVALID_WHATSAPP =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";

/** A stored WhatsApp number: international digits only, as `wa.me` expects. */
export const whatsappDigitsSchema = z
  .string(INVALID_WHATSAPP)
  .regex(/^[1-9][0-9]{7,14}$/, INVALID_WHATSAPP);

/**
 * A WhatsApp number as typed (`+55 (11) 99999-8888`), turned into its stored
 * digits. The leading `+` is required so a number without its country code
 * is never stored.
 */
export const whatsappInputSchema = z
  .string(INVALID_WHATSAPP)
  .trim()
  .regex(/^\+[0-9\s().-]+$/, INVALID_WHATSAPP)
  .transform((input) => input.replace(/\D/g, ""))
  .pipe(whatsappDigitsSchema);
