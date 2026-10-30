import { z } from "zod";
import { ASSIGNABLE_ROLES } from "../enums";
import { emailSchema, INVALID_EMAIL } from "./email";
import { optionalWhatsappInputSchema } from "./whatsapp";

// The one password minimum, shared by the API, the CLI and the web.
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

/** Stored lowercased, so one person has one invite per store. */
export const inviteRequestSchema = z.strictObject({
  email: emailSchema.max(254, INVALID_EMAIL).toLowerCase(),
  role: z.enum(ASSIGNABLE_ROLES, "Escolha o papel da pessoa."),
});
export type InviteRequest = z.infer<typeof inviteRequestSchema>;

const inviteTokenSchema = z.string().min(1).max(200);

export const inviteLookupRequestSchema = z.strictObject({
  token: inviteTokenSchema,
});
export type InviteLookupRequest = z.infer<typeof inviteLookupRequestSchema>;

const NAME_MESSAGE = "Informe seu nome.";
const PASSWORD_MESSAGE = `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;

export const acceptInviteRequestSchema = z.strictObject({
  token: inviteTokenSchema,
  name: z
    .string(NAME_MESSAGE)
    .trim()
    .min(1, NAME_MESSAGE)
    .max(60, "Use até 60 caracteres no nome."),
  password: z
    .string(PASSWORD_MESSAGE)
    .min(MIN_PASSWORD_LENGTH, PASSWORD_MESSAGE)
    .max(200, "Use até 200 caracteres na senha."),
  whatsappNumber: optionalWhatsappInputSchema,
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
