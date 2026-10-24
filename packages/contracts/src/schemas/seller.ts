import { z } from "zod";

export const sellerSchema = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  whatsappNumber: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  listingCount: z.number(),
});
export type Seller = z.infer<typeof sellerSchema>;

export const sellerRequestSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome.").max(60).optional(),
  whatsappNumber: z.string().nullish(),
});
export type SellerRequest = z.infer<typeof sellerRequestSchema>;
