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

export interface ListingAttribute {
  label: string;
  value: string;
}
