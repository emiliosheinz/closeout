import type { QueryKey } from "@tanstack/react-query";

/** What a mutation declares so the global cache handlers can give feedback once. */
export interface MutationMeta extends Record<string, unknown> {
  /** Success toast text; never read from the response, which may be unparsed. */
  success?: string;
  /** Query keys to invalidate after success. */
  invalidates?: QueryKey[];
  /** Returns true for errors the mutation shows itself, so no global toast. */
  handlesError?: (error: unknown) => boolean;
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: MutationMeta;
  }
}
