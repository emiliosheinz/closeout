// Store role rules as plain values, free of framework imports so domain rules
// (catalog/listing-rules.ts) can depend on them.

import { STORE_ROLES, type StoreRole } from "@closeout/contracts/enums";

export const ANY_MEMBER: readonly StoreRole[] = STORE_ROLES;
export const MANAGERS: readonly StoreRole[] = ["owner", "admin"];

export function isManager(role: StoreRole): boolean {
  return MANAGERS.includes(role);
}
