import { z } from "zod";
import { ASSIGNABLE_ROLES, STORE_ROLES } from "../enums";

export const teamMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(STORE_ROLES),
  sellerId: z.string(),
  displayName: z.string(),
  whatsappNumber: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  listingCount: z.number(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const memberRequestSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});
export type MemberRequest = z.infer<typeof memberRequestSchema>;
