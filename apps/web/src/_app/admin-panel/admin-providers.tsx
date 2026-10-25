"use client";

import {
  type DehydratedState,
  HydrationBoundary,
  QueryClientProvider,
} from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { Toaster } from "@/shared/ui/sonner";
import { makeAdminQueryClient } from "./model/query-client";

/**
 * Providers only the admin panel gets: the data cache, the toaster and the
 * URL state adapter behind the tables' search, sort and page.
 */
export function AdminProviders({
  state,
  children,
}: {
  state?: DehydratedState;
  children: React.ReactNode;
}) {
  const [client] = useState(makeAdminQueryClient);
  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>
        <HydrationBoundary state={state}>{children}</HydrationBoundary>
        <Toaster />
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
