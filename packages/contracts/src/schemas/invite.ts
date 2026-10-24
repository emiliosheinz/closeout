import { z } from "zod";
import { ASSIGNABLE_ROLES } from "../enums";
import { emailSchema } from "./email";

// Mirrors the API password minimum; the API cannot import schemas.
export const MIN_PASSWORD_LENGTH = 10;

export const pendingInviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(ASSIGNABLE_ROLES),
  expiresAt: z.iso.datetime(),
});
export type PendingInvite = z.infer<typeof pendingInviteSchema>;

export const issuedInviteSchema = z.object({
  invite: pendingInviteSchema,
  link: z.string(),
});
export type IssuedInvite = z.infer<typeof issuedInviteSchema>;

export const inviteDetailsSchema = z.object({
  storeName: z.string(),
  email: z.string(),
  role: z.enum(ASSIGNABLE_ROLES),
});
export type InviteDetails = z.infer<typeof inviteDetailsSchema>;

export const inviteRequestSchema = z.object({
  email: emailSchema,
  role: z.enum(ASSIGNABLE_ROLES),
});
export type InviteRequest = z.infer<typeof inviteRequestSchema>;

export const acceptInviteRequestSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(60),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    )
    .max(200),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
