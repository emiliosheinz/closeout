import type { WaitlistPlacement } from "@closeout/contracts/enums";
import {
  waitlistRefSchema,
  waitlistSrcSchema,
} from "@closeout/contracts/schemas";

export type SignupAttribution = { ref?: string; src?: WaitlistPlacement };

type SearchParams = Record<string, string | string[] | undefined>;

/** Keeps only the `ref` and `src` query values the signup API would accept. */
export function parseSignupAttribution(
  params: SearchParams,
): SignupAttribution {
  const ref = waitlistRefSchema.safeParse(params.ref);
  const src = waitlistSrcSchema.safeParse(params.src);
  return {
    ...(ref.success && { ref: ref.data }),
    ...(src.success && { src: src.data }),
  };
}
