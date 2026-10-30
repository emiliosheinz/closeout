import { z } from "zod";
import { optionalWhatsappInputSchema } from "./whatsapp";

export const sellerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  whatsappNumber: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  listingCount: z.number(),
});
export type Seller = z.infer<typeof sellerSchema>;

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
