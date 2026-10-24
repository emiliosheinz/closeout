"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { inviteReads, type PendingInvite } from "@/entities/invite";
import { memberReads, type TeamMember } from "@/entities/member";
import { InviteButton, PendingInvites } from "@/features/invite-actions";
import { MemberRow } from "@/features/member-actions";
import { readQuery } from "@/shared/api";
import { pluralize } from "@/shared/lib/format";

/**
 * The Equipe page body. Managers see every member and the pending invites,
 * read from the cache the page seeds so removals and revocations show up. A
 * seller gets only their own row (`ownRows`), which is also what hides every
 * team control.
 */
export function TeamView({
  storeId,
  viewerId,
  ownRows,
}: {
  storeId: string;
  viewerId: string;
  /** A seller's own row; null for managers, who read the whole team. */
  ownRows: TeamMember[] | null;
}) {
  if (ownRows) {
    return (
      <TeamSections
        storeId={storeId}
        viewerId={viewerId}
        members={ownRows}
        invites={null}
      />
    );
  }
  return <ManagerTeam storeId={storeId} viewerId={viewerId} />;
}

function ManagerTeam({
  storeId,
  viewerId,
}: {
  storeId: string;
  viewerId: string;
}) {
  const { data: team } = useSuspenseQuery(readQuery(memberReads.list(storeId)));
  const { data: pending } = useSuspenseQuery(
    readQuery(inviteReads.pending(storeId)),
  );
  return (
    <TeamSections
      storeId={storeId}
      viewerId={viewerId}
      members={team.items}
      invites={pending.items}
    />
  );
}

function TeamSections({
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
    <div className="flex flex-col gap-10">
      <section aria-labelledby="team-members">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          {canManage ? (
            <h2
              id="team-members"
              tabIndex={-1}
              className="text-sm font-semibold text-muted outline-none"
            >
              {pluralize(members.length, "pessoa", "pessoas")}
            </h2>
          ) : (
            <h2 id="team-members" tabIndex={-1} className="sr-only">
              Seu contato
            </h2>
          )}
          {canManage && <InviteButton storeId={storeId} />}
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {members.map((member) => (
            <MemberRow
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
          <h2
            id="team-invites"
            tabIndex={-1}
            className="mb-3 text-sm font-semibold text-muted outline-none"
          >
            Convites pendentes{" "}
            {invites.length > 0 && (
              <span className="font-medium">({invites.length})</span>
            )}
          </h2>
          <PendingInvites storeId={storeId} invites={invites} />
        </section>
      )}
    </div>
  );
}
