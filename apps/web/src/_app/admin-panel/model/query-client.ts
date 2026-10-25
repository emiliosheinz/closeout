import {
  MutationCache,
  QueryCache,
  type QueryClient,
} from "@tanstack/react-query";
import { SESSION_EXPIRED_HREF } from "@/entities/session";
import { ApiError, makeQueryClient } from "@/shared/api";
import { notify } from "@/shared/ui/sonner";

function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function expireSession(): void {
  if (typeof window === "undefined") return;
  window.location.assign(SESSION_EXPIRED_HREF);
}

/**
 * The admin panel's query client: the one place that turns query and
 * mutation outcomes into feedback, driven by each mutation's meta.
 */
export function makeAdminQueryClient(): QueryClient {
  return makeQueryClient({
    queryCache: new QueryCache({
      onError(error) {
        if (isSessionExpired(error)) expireSession();
      },
    }),
    mutationCache: new MutationCache({
      async onSuccess(_data, variables, _result, mutation, { client }) {
        const { success, invalidates = [] } = mutation.meta ?? {};
        if (success) {
          notify.success(
            typeof success === "function" ? success(variables) : success,
          );
        }
        await Promise.all(
          invalidates.map((queryKey) => client.invalidateQueries({ queryKey })),
        );
      },
      onError(error, _variables, _result, mutation) {
        if (isSessionExpired(error)) return expireSession();
        if (mutation.meta?.handlesError?.(error)) return;
        notify.failure(error);
      },
    }),
  });
}
