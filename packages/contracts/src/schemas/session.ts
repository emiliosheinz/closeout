import { z } from "zod";

/** Body of a successful login or invite acceptance. */
export const sessionResponseSchema = z.object({
  sessionToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
