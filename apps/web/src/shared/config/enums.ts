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

export type Role = "owner" | "admin" | "seller";

/** Roles an invite or a role change can grant; owner comes only from the CLI. */
export type AssignableRole = Exclude<Role, "owner">;
