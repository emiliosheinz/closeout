export const CONDITIONS = [
  "new",
  "like_new",
  "good",
  "fair",
  "for_parts",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const AVAILABILITIES = ["available", "reserved", "sold"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const PUBLICATIONS = ["draft", "published", "archived"] as const;
export type Publication = (typeof PUBLICATIONS)[number];

export const STORE_ROLES = ["owner", "admin", "seller"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

/** Roles a manager can give: the owner is set only by the operator CLI. */
export const ASSIGNABLE_ROLES = ["admin", "seller"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
