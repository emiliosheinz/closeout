import {
  isServer,
  QueryClient,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { cache } from "react";
import { ApiError } from "../http/api-error";
import "./mutation-meta";

/** Hydrated data should not refetch the moment the page mounts. */
const STALE_TIME_MS = 60_000;

/** A 4xx will not change on retry; anything else gets one more try. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function makeQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetry,
        ...config.defaultOptions?.queries,
      },
    },
  });
}

// One client per server request: a module-level instance would share one
// member's cached data with the next request.
const serverClient = cache(makeQueryClient);

let browserClient: QueryClient | undefined;

/** The request's client on the server, the one browser client elsewhere. */
export function getQueryClient(): QueryClient {
  if (isServer) return serverClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
