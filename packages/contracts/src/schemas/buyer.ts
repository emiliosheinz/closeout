import { z } from "zod";
import { AVAILABILITIES } from "../enums";
import { optionalWhatsappInputSchema, whatsappDigitsSchema } from "./whatsapp";

/**
 * The key buyer names are unique by: compatibility-normalized, without accents
 * or invisible format characters, trimmed, single-spaced and lowercase.
 */
export function buyerNameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const BUYER_NAME_MESSAGE = "Informe o nome do comprador.";

export const buyerNameSchema = z
  .string(BUYER_NAME_MESSAGE)
  .trim()
  .min(1, BUYER_NAME_MESSAGE)
  .max(120, "Use até 120 caracteres no nome.")
  .refine((name) => buyerNameKey(name) !== "", BUYER_NAME_MESSAGE);

export const buyerSchema = z.object({
  id: z.string(),
  name: z.string(),
  whatsappNumber: whatsappDigitsSchema.nullable(),
});
export type Buyer = z.infer<typeof buyerSchema>;

export const buyerSummarySchema = buyerSchema.extend({
  linkedCount: z.number(),
  items: z.array(
    z.object({
      listingId: z.string(),
      title: z.string(),
      availability: z.enum(AVAILABILITIES),
      agreedPriceCents: z.number().nullable(),
      paid: z.boolean(),
    }),
  ),
  owedCents: z.number(),
  unpricedCount: z.number(),
});
export type BuyerSummary = z.infer<typeof buyerSummarySchema>;

/** An existing buyer by id, or a buyer by name that is found or created. */
export const buyerRefSchema = z.union([
  z.strictObject({
    id: z.uuid("Comprador inválido."),
    whatsappNumber: optionalWhatsappInputSchema,
  }),
  z.strictObject({
    name: buyerNameSchema,
    whatsappNumber: optionalWhatsappInputSchema,
  }),
]);
export type BuyerRef = z.infer<typeof buyerRefSchema>;

export const buyerUpdateRequestSchema = z.strictObject({
  name: buyerNameSchema.optional(),
  whatsappNumber: optionalWhatsappInputSchema,
});
export type BuyerUpdateRequest = z.infer<typeof buyerUpdateRequestSchema>;

export const buyerMergeRequestSchema = z.strictObject({
  targetId: z.uuid("Escolha o comprador que vai ficar."),
});
export type BuyerMergeRequest = z.infer<typeof buyerMergeRequestSchema>;
