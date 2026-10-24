import type { StoreRole } from "@closeout/contracts/enums";

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
  memberships: { role: StoreRole; sellerId: string; store: StoreSettings }[];
}

export interface Member {
  me: Me;
  store: StoreSettings;
  role: StoreRole;
  /** The caller's own contact profile in the store. */
  sellerId: string;
}
