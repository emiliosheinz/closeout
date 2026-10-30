import { z } from "zod";
import { AVAILABILITIES, CONDITIONS, PUBLICATIONS } from "../enums";
import { adminImageSchema } from "./image";

export const MAX_PRICE_CENTS = 100_000_000;

const conditionSchema = z.enum(CONDITIONS);
const availabilitySchema = z.enum(AVAILABILITIES);
const publicationSchema = z.enum(PUBLICATIONS);

export const listingAttributeSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type ListingAttribute = z.infer<typeof listingAttributeSchema>;

export const adminListingSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  priceCents: z.number().nullable(),
  condition: conditionSchema,
  availability: availabilitySchema,
  publication: publicationSchema,
  category: z.object({ id: z.string(), name: z.string() }),
  sellers: z.array(z.object({ id: z.string(), displayName: z.string() })),
  coverUrl: z.string().nullable(),
  imageCount: z.number(),
  updatedAt: z.iso.datetime(),
});
export type AdminListingSummary = z.infer<typeof adminListingSummarySchema>;

export const adminListingDetailSchema = adminListingSummarySchema.extend({
  description: z.string(),
  attributes: z.array(listingAttributeSchema),
  images: z.array(adminImageSchema),
});
export type AdminListingDetail = z.infer<typeof adminListingDetailSchema>;

export const dashboardCountsSchema = z.object({
  published: z.number(),
  available: z.number(),
  reserved: z.number(),
  sold: z.number(),
  draft: z.number(),
  archived: z.number(),
});
export type DashboardCounts = z.infer<typeof dashboardCountsSchema>;

const PRICE_MESSAGE =
  'Use um valor como 1.200,00, ou deixe vazio para "Preço a combinar".';
const TITLE_MESSAGE = "Dê um nome ao item.";
const SELLERS_MESSAGE =
  "Escolha ao menos uma pessoa para receber as mensagens.";
const ATTRIBUTE_LABEL_MESSAGE =
  "Dê um nome de até 40 caracteres a cada característica.";
const ATTRIBUTE_VALUE_MESSAGE =
  "Preencha cada característica com até 120 caracteres.";

const sellerIdsSchema = z
  .array(z.uuid("Vendedor inválido."), SELLERS_MESSAGE)
  .min(1, SELLERS_MESSAGE)
  .max(10, "Escolha no máximo 10 pessoas.")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Escolha cada pessoa uma vez só.",
  );

/**
 * A new listing, as the admin form submits it. Every rule carries its own
 * message because the web form parses this schema directly.
 */
export const listingRequestSchema = z.strictObject({
  title: z
    .string(TITLE_MESSAGE)
    .trim()
    .min(1, TITLE_MESSAGE)
    .max(120, "Use até 120 caracteres no nome."),
  description: z
    .string("Escreva a descrição como texto.")
    .trim()
    .max(5000, "Use até 5000 caracteres na descrição.")
    .optional(),
  categoryId: z.uuid("Escolha uma categoria."),
  sellerIds: sellerIdsSchema.optional(),
  priceCents: z
    .number(PRICE_MESSAGE)
    .int(PRICE_MESSAGE)
    .min(0, PRICE_MESSAGE)
    .max(MAX_PRICE_CENTS, PRICE_MESSAGE)
    .nullish(),
  condition: z.enum(CONDITIONS, "Escolha o estado do item."),
  attributes: z
    .array(
      z.strictObject(
        {
          label: z
            .string(ATTRIBUTE_LABEL_MESSAGE)
            .trim()
            .min(1, ATTRIBUTE_LABEL_MESSAGE)
            .max(40, ATTRIBUTE_LABEL_MESSAGE),
          value: z
            .string(ATTRIBUTE_VALUE_MESSAGE)
            .trim()
            .min(1, ATTRIBUTE_VALUE_MESSAGE)
            .max(120, ATTRIBUTE_VALUE_MESSAGE),
        },
        ATTRIBUTE_LABEL_MESSAGE,
      ),
      "Informe as características como uma lista.",
    )
    .max(20, "Use até 20 características.")
    .optional(),
});
export type ListingRequest = z.infer<typeof listingRequestSchema>;

/** Changes to a listing: any create field, plus its availability and publication. */
export const listingUpdateRequestSchema = listingRequestSchema
  .partial()
  .extend({
    availability: availabilitySchema.optional(),
    publication: publicationSchema.optional(),
  });
export type ListingUpdateRequest = z.infer<typeof listingUpdateRequestSchema>;

export const listingStatusRequestSchema = z.strictObject({
  availability: availabilitySchema.optional(),
  publication: publicationSchema.optional(),
});
export type ListingStatusRequest = z.infer<typeof listingStatusRequestSchema>;

/** Every photo id of a listing, in its new order. */
export const reorderImagesRequestSchema = z.strictObject({
  ids: z.array(z.uuid()).max(50),
});
export type ReorderImagesRequest = z.infer<typeof reorderImagesRequestSchema>;

export const adminListingsQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
});
export type AdminListingsQuery = z.infer<typeof adminListingsQuerySchema>;
