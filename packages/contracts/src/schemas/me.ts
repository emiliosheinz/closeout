import { z } from "zod";
import { STORE_ROLES } from "../enums";
import { emailSchema } from "./email";
import { storeSettingsSchema } from "./store";

export const meSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  memberships: z.array(
    z.object({
      role: z.enum(STORE_ROLES),
      sellerId: z.string(),
      store: storeSettingsSchema,
    }),
  ),
});
export type Me = z.infer<typeof meSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
