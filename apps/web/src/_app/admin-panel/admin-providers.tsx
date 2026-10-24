"use client";

import {
  type DehydratedState,
  HydrationBoundary,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/shared/ui/sonner";
import { makeAdminQueryClient } from "./model/query-client";

/** Providers only the admin panel gets: the data cache and the toaster. */
export function AdminProviders({
  state,
  children,
}: {
  state?: DehydratedState;
  children: React.ReactNode;
}) {
  const [client] = useState(makeAdminQueryClient);
  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={state}>{children}</HydrationBoundary>
      <Toaster />
    </QueryClientProvider>
  );
}
