import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "../query/query-client";
import type { Read } from "../query/read";
import { adminFetch } from "./admin-get";

/**
 * Loads a read into this request's query client and returns it. A missing
 * resource (null) is not cached, and a failed or malformed response throws, so
 * the page handles both before rendering. `onUnauthorized` runs when the API
 * says the session is gone, so the page can send the member to login.
 */
export async function loadRead<T>(
  { queryKey, path, schema }: Read<T>,
  onUnauthorized?: () => never,
): Promise<T | null> {
  const client = getQueryClient();
  const data = await client.fetchQuery({
    queryKey,
    queryFn: async () => {
      const outcome = await adminFetch(path, schema);
      if ("data" in outcome) return outcome.data;
      if (outcome.status === 401) onUnauthorized?.();
      return null;
    },
    retry: false,
  });
  if (data === null) client.removeQueries({ queryKey, exact: true });
  return data;
}

/** Hands everything the page loaded to the browser's query cache. */
export function Hydrated({ children }: { children: React.ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}
