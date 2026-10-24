import type { StoreRole } from "@closeout/contracts/enums";

/** Owners and admins manage the store and its team; sellers only their own listings. */
export function isManager(role: StoreRole): boolean {
  return role === "owner" || role === "admin";
}
