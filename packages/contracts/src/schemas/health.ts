import { z } from "zod";

/** Body of a healthy `GET /health`: the API is up and reaches its database. */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  checks: z.object({ database: z.literal("up") }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
