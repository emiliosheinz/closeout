// Store roles as plain values, free of framework imports so domain rules
// (catalog/listing-rules.ts) can depend on them.

export const STORE_ROLES = ["owner", "admin", "seller"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

/** Roles a manager can give: the owner is set only by the operator CLI. */
export const ASSIGNABLE_ROLES = ["admin", "seller"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ANY_MEMBER: readonly StoreRole[] = STORE_ROLES;
export const MANAGERS: readonly StoreRole[] = ["owner", "admin"];

export function isManager(role: StoreRole): boolean {
  return MANAGERS.includes(role);
}
