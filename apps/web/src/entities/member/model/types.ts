import type { StoreRole } from "@closeout/contracts/enums";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: StoreRole;
  sellerId: string;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}
