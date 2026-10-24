import { dehydrate, hashKey } from "@tanstack/react-query";
import { sessionKeys } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { getQueryClient } from "@/shared/api";
import { AdminNav } from "./admin-nav";
import { AdminProviders } from "./admin-providers";

export async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  const queryClient = getQueryClient();
  return (
    <AdminProviders
      state={dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.queryHash === hashKey(sessionKeys.me()),
      })}
    >
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </AdminProviders>
  );
}
