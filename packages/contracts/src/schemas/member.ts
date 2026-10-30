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

export const memberRequestSchema = z.strictObject({
  role: z.enum(ASSIGNABLE_ROLES, "Escolha o papel da pessoa."),
});
export type MemberRequest = z.infer<typeof memberRequestSchema>;
