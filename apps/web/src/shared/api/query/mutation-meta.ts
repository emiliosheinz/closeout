import type { QueryKey } from "@tanstack/react-query";

/** What a mutation declares so the global cache handlers can give feedback once. */
export interface MutationMeta extends Record<string, unknown> {
  /**
   * Success toast text, fixed or derived from the mutation's variables; never
   * read from the response, which may be unparsed.
   */
  success?: string | ((variables: unknown) => string);
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

/** Types a success message that depends on the variables the mutation was called with. */
export function successFor<TVariables>(
  message: (variables: TVariables) => string,
): (variables: unknown) => string {
  return (variables) => message(variables as TVariables);
}
