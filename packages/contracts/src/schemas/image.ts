import { z } from "zod";

export const publicImageSchema = z.object({
  sm: z.string(),
  lg: z.string(),
  og: z.string(),
  width: z.number(),
  height: z.number(),
});
export type PublicImage = z.infer<typeof publicImageSchema>;

export const adminImageSchema = z.object({
  id: z.string(),
  position: z.number(),
  width: z.number(),
  height: z.number(),
  urls: z.object({ sm: z.string(), lg: z.string() }),
});
export type AdminImage = z.infer<typeof adminImageSchema>;
