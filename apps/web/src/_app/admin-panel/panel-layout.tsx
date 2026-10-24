import { dehydrate, hashKey } from "@tanstack/react-query";
import { AdminNav } from "@/_app/admin-panel/admin-nav";
import { AdminProviders } from "@/_app/admin-panel/admin-providers";
import { sessionKeys } from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { getQueryClient } from "@/shared/api";

export async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireMember();
  const queryClient = getQueryClient();
  queryClient.setQueryData(sessionKeys.me(), me);
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
