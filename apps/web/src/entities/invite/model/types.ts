import type { AssignableRole } from "@/shared/config/enums";

export interface PendingInvite {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: string;
}

export interface IssuedInvite {
  invite: PendingInvite;
  link: string;
}
