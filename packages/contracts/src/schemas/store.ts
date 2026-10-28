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

const NAME_MESSAGE = "Informe o nome da loja.";

export const storeRequestSchema = z.strictObject({
  name: z
    .string(NAME_MESSAGE)
    .trim()
    .min(1, NAME_MESSAGE)
    .max(80, "Use até 80 caracteres no nome da loja.")
    .optional(),
  headline: z
    .string("Escreva a chamada principal como texto.")
    .trim()
    .max(160, "Use até 160 caracteres na chamada principal.")
    .optional(),
  intro: z
    .string("Escreva a apresentação como texto.")
    .trim()
    .max(1200, "Use até 1200 caracteres na apresentação.")
    .optional(),
});
export type StoreRequest = z.infer<typeof storeRequestSchema>;
