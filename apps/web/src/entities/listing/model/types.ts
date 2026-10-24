import type {
  Availability,
  Condition,
  Publication,
} from "@/shared/config/enums";

export interface PublicImage {
  sm: string;
  lg: string;
  og: string;
  width: number;
  height: number;
}

export interface ListingAttribute {
  label: string;
  value: string;
}

export interface ListingSummary {
  slug: string;
  title: string;
  priceCents: number | null;
  condition: Condition;
  availability: Availability;
  category: { slug: string; name: string };
  cover: PublicImage | null;
}

export interface ListingDetail extends ListingSummary {
  description: string;
  attributes: ListingAttribute[];
  images: PublicImage[];
  /** Alphabetical; numbers are null unless the item can be contacted. */
  sellers: {
    name: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
  }[];
  canContact: boolean;
  publishedAt: string | null;
  updatedAt: string;
  related: ListingSummary[];
}

export interface StoreInfo {
  slug: string;
  name: string;
  headline: string;
  intro: string;
  locale: string;
  currency: string;
  counts: { available: number; reserved: number; sold: number };
  categories: { slug: string; name: string; count: number }[];
  sellers: { name: string; avatarUrl: string | null; whatsappNumber: string }[];
}

export interface ListingPage {
  items: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminImage {
  id: string;
  position: number;
  width: number;
  height: number;
  urls: { sm: string; lg: string };
}

export interface AdminListingSummary {
  id: string;
  slug: string;
  title: string;
  priceCents: number | null;
  condition: Condition;
  availability: Availability;
  publication: Publication;
  category: { id: string; name: string };
  sellers: { id: string; displayName: string }[];
  coverUrl: string | null;
  imageCount: number;
  updatedAt: string;
}

export interface AdminListingDetail extends AdminListingSummary {
  description: string;
  attributes: ListingAttribute[];
  images: AdminImage[];
}

export interface DashboardCounts {
  published: number;
  available: number;
  reserved: number;
  sold: number;
  draft: number;
  archived: number;
}

export interface Seller {
  id: string;
  userId: string | null;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}
