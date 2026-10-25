import { queryOptions } from "@tanstack/react-query";
import { apiGet } from "../http/client";
import type { Schema } from "../http/schema";

/**
 * One admin read: its cache key, API path and response schema. Pages load it
 * with the server fetcher and components read it through `readQuery`, so both
 * fill the same cache entry.
 */
export interface Read<T> {
  queryKey: readonly unknown[];
  path: string;
  schema: Schema<T>;
}

/** The browser query for a read. */
export function readQuery<T>({ queryKey, path, schema }: Read<T>) {
  return queryOptions({ queryKey, queryFn: () => apiGet(path, schema) });
}
