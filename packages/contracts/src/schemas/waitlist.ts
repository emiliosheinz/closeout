import { z } from "zod";
import { WAITLIST_CHANNELS, WAITLIST_PLACEMENTS } from "../enums";
import { emailSchema, INVALID_EMAIL } from "./email";
import { INVALID_VALUE } from "./problem";
import { storeSlugSchema } from "./store";
import { whatsappInputSchema } from "./whatsapp";

const NAME_MESSAGE = "Informe seu nome.";

const nameSchema = z
  .string(NAME_MESSAGE)
  .trim()
  .min(1, NAME_MESSAGE)
  .max(100, "Use até 100 caracteres no nome.");

const channelSchema = z.enum(WAITLIST_CHANNELS, "Escolha WhatsApp ou e-mail.");

const emailContactSchema = emailSchema.max(254, INVALID_EMAIL).toLowerCase();

/** Where the signup came from: the store it started on, as a store slug. */
export const waitlistRefSchema = storeSlugSchema.max(100, INVALID_VALUE);

/** The placement that linked to the waitlist. */
export const waitlistSrcSchema = z.enum(WAITLIST_PLACEMENTS, INVALID_VALUE);

const fieldShape = {
  name: nameSchema,
  channel: channelSchema,
  contact: z.string(),
};

/** Validates the contact by the chosen channel and stores it normalized. */
function normalizeContact<Value extends { channel: string; contact: string }>(
  value: Value,
  ctx: z.RefinementCtx,
): Value {
  const result = (
    value.channel === "whatsapp" ? whatsappInputSchema : emailContactSchema
  ).safeParse(value.contact);
  if (result.success) return { ...value, contact: result.data };
  ctx.addIssue({
    code: "custom",
    message: result.error.issues[0]?.message,
    path: ["contact"],
  });
  return z.NEVER;
}

/**
 * The fields a visitor fills in. A validator on the web: the form sends
 * the values as typed, because the API rejects a WhatsApp number without
 * its `+`.
 */
export const waitlistFieldsSchema = z
  .object(fieldShape)
  .transform(normalizeContact);
export type WaitlistFields = z.input<typeof waitlistFieldsSchema>;

/**
 * A waitlist signup. `website` is a honeypot that people leave empty.
 * The parsed contact is already normalized: digits for WhatsApp, a
 * lowercased address for e-mail.
 */
export const waitlistSignupRequestSchema = z
  .strictObject({
    ...fieldShape,
    ref: waitlistRefSchema.optional(),
    src: waitlistSrcSchema.optional(),
    website: z.string().optional(),
  })
  .transform(normalizeContact);
export type WaitlistSignupRequest = z.infer<typeof waitlistSignupRequestSchema>;
