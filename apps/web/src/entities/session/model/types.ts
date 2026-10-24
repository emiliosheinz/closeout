import type { StoreRole } from "@closeout/contracts/enums";
import type { Me, StoreSettings } from "@closeout/contracts/schemas";

export type { Me };

export interface Member {
  me: Me;
  store: StoreSettings;
  role: StoreRole;
  /** The caller's own contact profile in the store. */
  sellerId: string;
}
