import { z } from "zod";

export const storeSettingsSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  headline: z.string(),
  intro: z.string(),
  locale: z.string(),
  currency: z.string(),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export const storeRequestSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da loja.").max(80).optional(),
  headline: z.string().trim().max(160).optional(),
  intro: z.string().trim().max(1200).optional(),
});
export type StoreRequest = z.infer<typeof storeRequestSchema>;
