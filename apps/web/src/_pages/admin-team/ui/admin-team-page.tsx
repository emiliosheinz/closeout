import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { inviteReads, type PendingInvite } from "@/entities/invite";
import { listingReads } from "@/entities/listing";
import { memberReads, type TeamMember } from "@/entities/member";
import {
  isManager,
  type Member,
  SESSION_EXPIRED_HREF,
} from "@/entities/session";
import { requireMember } from "@/entities/session/index.server";
import { Hydrated, loadRead } from "@/shared/api/index.server";
import { TeamView } from "./team-view";

const sessionEnded = (): never => redirect(SESSION_EXPIRED_HREF);

export const metadata: Metadata = { title: "Equipe" };

/**
 * Managers load every member and the pending invites; a seller loads only
 * their own contact profile, and `invites: null` hides the team controls.
 */
async function loadTeam({ me, store, role, sellerId }: Member): Promise<{
  members: TeamMember[];
  invites: PendingInvite[] | null;
}> {
  if (isManager(role)) {
    const [team, pending] = await Promise.all([
      loadRead(memberReads.list(store.id), sessionEnded),
      loadRead(inviteReads.pending(store.id), sessionEnded),
    ]);
    if (!team || !pending) notFound();
    return { members: team.items, invites: pending.items };
  }
  const sellers = await loadRead(listingReads.sellers(store.id), sessionEnded);
  if (!sellers) notFound();
  const own = sellers.items.find((seller) => seller.id === sellerId);
  if (!own) return { members: [], invites: null };
  return {
    members: [
      {
        userId: me.user.id,
        name: me.user.name,
        email: me.user.email,
        role,
        sellerId: own.id,
        displayName: own.displayName,
        whatsappNumber: own.whatsappNumber,
        avatarUrl: own.avatarUrl,
        listingCount: own.listingCount,
      },
    ],
    invites: null,
  };
}

export async function TeamPage() {
  const member = await requireMember();
  const { me, store } = member;
  const manager = isManager(member.role);
  const { members, invites } = await loadTeam(member);

  return (
    <Hydrated>
      <h1 className="text-3xl font-extrabold">Equipe</h1>
      <p className="mt-1 max-w-[60ch] text-ink-soft">
        {manager
          ? "Quem vende e quem cuida da loja. O botão de WhatsApp de cada anúncio abre a conversa com quem vende."
          : "Seu contato na loja. O botão de WhatsApp dos seus anúncios abre a conversa com você."}
      </p>
      <div className="mt-8">
        <TeamView
          storeId={store.id}
          viewerId={me.user.id}
          members={members}
          invites={invites}
        />
      </div>
    </Hydrated>
  );
}
