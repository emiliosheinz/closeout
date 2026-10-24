import type { Role } from "@/shared/config/enums";

/** Owners and admins manage the store and its team; sellers only their own listings. */
export function isManager(role: Role): boolean {
  return role === "owner" || role === "admin";
}
