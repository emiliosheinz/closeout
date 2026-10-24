import type { Role } from "@/shared/config/enums";

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

export interface Member {
  me: Me;
  store: StoreSettings;
  role: Role;
  /** The caller's own contact profile in the store. */
  sellerId: string;
}
