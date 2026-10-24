import type { PendingInvite, TeamMember } from "@/lib/admin/types";
import { pluralize } from "@/lib/format";
import { Invites } from "./invites";
import { MemberCard } from "./member-card";

/**
 * The Equipe page body. Managers get every member and the invites; a seller
 * gets only their own card (pass just that member and `invites: null`,
 * which is also what hides every team control).
 */
export function TeamView({
  storeId,
  viewerId,
  members,
  invites,
}: {
  storeId: string;
  viewerId: string;
  members: TeamMember[];
  invites: PendingInvite[] | null;
}) {
  const canManage = invites !== null;
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="team-members">
        {canManage && (
          <h2
            id="team-members"
            className="mb-4 flex items-baseline gap-2 text-xl font-bold"
          >
            Pessoas
            <span className="text-base font-semibold text-muted">
              {pluralize(members.length, "pessoa", "pessoas")}
            </span>
          </h2>
        )}
        {!canManage && (
          <h2 id="team-members" className="sr-only">
            Seu contato
          </h2>
        )}
        <ul className="grid gap-4 md:grid-cols-2">
          {members.map((member) => (
            <MemberCard
              key={member.userId}
              storeId={storeId}
              member={member}
              isSelf={member.userId === viewerId}
              canManageTeam={canManage}
            />
          ))}
        </ul>
      </section>
      {invites && (
        <section aria-labelledby="team-invites">
          <h2 id="team-invites" className="text-xl font-bold">
            Convidar
          </h2>
          <p className="mt-1 mb-4 max-w-[60ch] text-ink-soft">
            Gere um link de convite e mande para a pessoa. Ela cria a própria
            senha e entra direto na loja.
          </p>
          <Invites storeId={storeId} invites={invites} />
        </section>
      )}
    </div>
  );
}
