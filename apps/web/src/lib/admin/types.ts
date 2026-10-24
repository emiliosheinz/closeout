import type {
  AssignableRole,
  Availability,
  Condition,
  Publication,
  Role,
} from "@/shared/config/enums";
import type { ListingAttribute } from "../catalog/types";

export interface StoreSettings {
  id: string;
  slug: string;
  name: string;
  headline: string;
  intro: string;
  locale: string;
  currency: string;
}

export interface Me {
  user: { id: string; name: string; email: string };
  memberships: { role: Role; sellerId: string; store: StoreSettings }[];
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

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: Role;
  sellerId: string;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: string;
}

export interface IssuedInvite {
  invite: PendingInvite;
  link: string;
}
