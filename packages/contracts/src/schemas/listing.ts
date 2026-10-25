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

export const listingRequestSchema = z.object({
  title: z.string().trim().min(1, "Dê um nome ao item.").max(120),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string(),
  sellerIds: z
    .array(z.string())
    .min(1, "Escolha ao menos uma pessoa para receber as mensagens.")
    .max(10)
    .optional(),
  priceCents: z
    .number(PRICE_MESSAGE)
    .int(PRICE_MESSAGE)
    .min(0, PRICE_MESSAGE)
    .max(MAX_PRICE_CENTS, PRICE_MESSAGE)
    .nullish(),
  condition: conditionSchema,
  attributes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        value: z.string().trim().min(1).max(120),
      }),
    )
    .max(20)
    .optional(),
});
export type ListingRequest = z.infer<typeof listingRequestSchema>;
