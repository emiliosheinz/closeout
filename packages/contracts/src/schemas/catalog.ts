import { z } from "zod";
import { AVAILABILITIES, CONDITIONS } from "../enums";
import { publicImageSchema } from "./image";
import { listingAttributeSchema, MAX_PRICE_CENTS } from "./listing";

export const publicListingSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  priceCents: z.number().nullable(),
  condition: z.enum(CONDITIONS),
  availability: z.enum(AVAILABILITIES),
  category: z.object({ slug: z.string(), name: z.string() }),
  cover: publicImageSchema.nullable(),
});
export type PublicListingSummary = z.infer<typeof publicListingSummarySchema>;

export const publicListingDetailSchema = publicListingSummarySchema.extend({
  description: z.string(),
  attributes: z.array(listingAttributeSchema),
  images: z.array(publicImageSchema),
  sellers: z.array(
    z.object({
      name: z.string(),
      avatarUrl: z.string().nullable(),
      whatsappNumber: z.string().nullable(),
    }),
  ),
  canContact: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  related: z.array(publicListingSummarySchema),
});
export type PublicListingDetail = z.infer<typeof publicListingDetailSchema>;

/** Items stay unparsed so a caller can drop the ones that fail their own schema. */
export const publicListingPageSchema = z.object({
  items: z.array(z.unknown()),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PublicListingPage = z.infer<typeof publicListingPageSchema>;

export const publicStoreSchema = z.object({
  slug: z.string(),
  name: z.string(),
  headline: z.string(),
  intro: z.string(),
  locale: z.string(),
  currency: z.string(),
  counts: z.object({
    available: z.number(),
    reserved: z.number(),
    sold: z.number(),
  }),
  categories: z.array(
    z.object({ slug: z.string(), name: z.string(), count: z.number() }),
  ),
  sellers: z.array(
    z.object({
      name: z.string(),
      avatarUrl: z.string().nullable(),
      whatsappNumber: z.string(),
    }),
  ),
});
export type PublicStore = z.infer<typeof publicStoreSchema>;

export const publicStoreIndexSchema = z.object({
  items: z.array(z.object({ slug: z.string() })),
});
export type PublicStoreIndex = z.infer<typeof publicStoreIndexSchema>;

export const CATALOG_SORTS = ["recent", "price_asc", "price_desc"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** `listed`, the default, means available or reserved. */
export const AVAILABILITY_FILTERS = [
  "listed",
  "available",
  "reserved",
  "sold",
  "all",
] as const;
export type AvailabilityFilter = (typeof AVAILABILITY_FILTERS)[number];

/** A whole number in a query string, within bounds. */
const queryInteger = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional();

/** Public catalog filters, sort and page. Prices are integer cents. */
export const catalogQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(60).optional(),
  condition: z.enum(CONDITIONS).optional(),
  availability: z.enum(AVAILABILITY_FILTERS).optional(),
  minPrice: queryInteger(0, MAX_PRICE_CENTS),
  maxPrice: queryInteger(0, MAX_PRICE_CENTS),
  sort: z.enum(CATALOG_SORTS).optional(),
  page: queryInteger(1, 1000),
  pageSize: queryInteger(1, 100),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
