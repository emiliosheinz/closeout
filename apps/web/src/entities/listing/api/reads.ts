import {
  adminListingDetailSchema,
  adminListingSummarySchema,
  categorySchema,
  publicListingDetailSchema,
  sellerSchema,
} from "@closeout/contracts/schemas";
import { listOf, type Read } from "@/shared/api";
import { listingKeys } from "../model/keys";
import type {
  AdminListingDetail,
  AdminListingSummary,
  Category,
  ListingDetail,
  Seller,
} from "../model/types";

const base = (storeId: string) => `/stores/${storeId}`;

export const listingReads = {
  /** Every listing the member can see; tabs, search and sort work on it. */
  list: (storeId: string): Read<{ items: AdminListingSummary[] }> => ({
    queryKey: listingKeys.list(storeId),
    path: `${base(storeId)}/listings`,
    schema: listOf(adminListingSummarySchema),
  }),
  detail: (storeId: string, id: string): Read<AdminListingDetail> => ({
    queryKey: listingKeys.detail(storeId, id),
    path: `${base(storeId)}/listings/${id}`,
    schema: adminListingDetailSchema,
  }),
  preview: (storeId: string, id: string): Read<ListingDetail> => ({
    queryKey: listingKeys.preview(storeId, id),
    path: `${base(storeId)}/listings/${id}/preview`,
    schema: publicListingDetailSchema,
  }),
  categories: (storeId: string): Read<{ items: Category[] }> => ({
    queryKey: listingKeys.categories(storeId),
    path: `${base(storeId)}/categories`,
    schema: listOf(categorySchema),
  }),
  sellers: (storeId: string): Read<{ items: Seller[] }> => ({
    queryKey: listingKeys.sellers(storeId),
    path: `${base(storeId)}/sellers`,
    schema: listOf(sellerSchema),
  }),
};
