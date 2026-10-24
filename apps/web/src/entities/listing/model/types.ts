import type {
  AdminImage,
  AdminListingDetail,
  AdminListingSummary,
  Category,
  DashboardCounts,
  ListingAttribute,
  PublicImage,
  PublicListingDetail,
  PublicListingSummary,
  PublicStore,
  Seller,
} from "@closeout/contracts/schemas";

export type {
  AdminImage,
  AdminListingDetail,
  AdminListingSummary,
  Category,
  DashboardCounts,
  ListingAttribute,
  PublicImage,
  Seller,
};
export type ListingSummary = PublicListingSummary;
export type ListingDetail = PublicListingDetail;
export type StoreInfo = PublicStore;

export interface ListingPage {
  items: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  /** Items the API sent, including any dropped for failing their schema. */
  received: number;
}
