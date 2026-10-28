import { z } from "zod";
import { whatsappInputSchema } from "./whatsapp";

export const sellerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  whatsappNumber: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  listingCount: z.number(),
});
export type Seller = z.infer<typeof sellerSchema>;

/** A contact number as typed, stored as digits; empty or null clears it. */
export const optionalWhatsappInputSchema = z.preprocess(
  (input) => (typeof input === "string" && input.trim() === "" ? null : input),
  whatsappInputSchema.nullish(),
);

const DISPLAY_NAME_MESSAGE = "Informe o nome.";

export const sellerRequestSchema = z.strictObject({
  displayName: z
    .string(DISPLAY_NAME_MESSAGE)
    .trim()
    .min(1, DISPLAY_NAME_MESSAGE)
    .max(60, "Use até 60 caracteres no nome.")
    .optional(),
  whatsappNumber: optionalWhatsappInputSchema,
});
export type SellerRequest = z.infer<typeof sellerRequestSchema>;
