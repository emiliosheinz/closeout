import type { Role } from "@/shared/config/enums";

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: Role;
  sellerId: string;
  displayName: string;
  whatsappNumber: string | null;
  avatarUrl: string | null;
  listingCount: number;
}
