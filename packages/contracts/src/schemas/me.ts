import { z } from "zod";
import { STORE_ROLES } from "../enums";
import { emailSchema, INVALID_EMAIL } from "./email";
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

const PASSWORD_MESSAGE = "Informe sua senha.";

export const loginRequestSchema = z.strictObject({
  email: emailSchema.max(254, INVALID_EMAIL),
  password: z
    .string(PASSWORD_MESSAGE)
    .min(1, PASSWORD_MESSAGE)
    .max(200, "Use até 200 caracteres na senha."),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
