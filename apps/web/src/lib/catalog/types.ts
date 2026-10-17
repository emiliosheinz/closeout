export type Condition = "new" | "like_new" | "good" | "fair" | "for_parts";
export type Availability = "available" | "reserved" | "sold";
export type Publication = "draft" | "published" | "archived";

export const CONDITIONS: Condition[] = [
  "new",
  "like_new",
  "good",
  "fair",
  "for_parts",
];
export const AVAILABILITIES: Availability[] = ["available", "reserved", "sold"];

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
