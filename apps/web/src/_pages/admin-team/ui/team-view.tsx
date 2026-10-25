"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  InviteIdentity,
  inviteReads,
  type PendingInvite,
} from "@/entities/invite";
import {
  MemberContact,
  MemberIdentity,
  memberReads,
  type TeamMember,
} from "@/entities/member";
import { InviteActions, InviteButton } from "@/features/invite-actions";
import { MemberActions } from "@/features/member-actions";
import { readQuery } from "@/shared/api";
import { formatDate, pluralize, ROLE_LABELS } from "@/shared/lib/format";
import {
  clampPage,
  createTableUrlState,
  useTableUrlState,
} from "@/shared/lib/table-url-state";
import { compareText, matchesSearch } from "@/shared/lib/text";
import {
  DataTable,
  type DataTableColumns,
  useDataTable,
} from "@/shared/ui/data-table/data-table";
import { inputClass } from "@/shared/ui/field";

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

const ROLE_ORDER: Record<TeamMember["role"], number> = {
  owner: 0,
  admin: 1,
  seller: 2,
};

const membersUrlState = createTableUrlState({
  prefix: "membros-",
  sorts: ["nome", "papel"],
  defaultSort: null,
});

const invitesUrlState = createTableUrlState({
  prefix: "convites-",
  sorts: ["validade"],
  defaultSort: { column: "validade", direction: "asc" },
});

function RoleCell({ role }: { role: TeamMember["role"] }) {
  return (
    <span className="hidden text-sm text-ink-soft sm:inline">
      {ROLE_LABELS[role]}
    </span>
  );
}

function SearchInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} w-full sm:max-w-xs`}
      />
    </div>
  );
}

function MembersTable({
  storeId,
  viewerId,
  members,
  canManage,
}: {
  storeId: string;
  viewerId: string;
  members: TeamMember[];
  /** Managers get search and sort; a seller's single row gets neither. */
  canManage: boolean;
}) {
  const [{ query, sort, page }, set] = useTableUrlState(
    membersUrlState,
    members.length,
  );
  const shown = members.filter(
    (member) =>
      !query ||
      matchesSearch(member.displayName, query) ||
      matchesSearch(member.email, query),
  );
  const columns: DataTableColumns<TeamMember> = [
    {
      id: "nome",
      header: "Nome",
      accessorFn: (member) => member.displayName,
      enableSorting: canManage,
      sortFn: (a, b) =>
        compareText(a.original.displayName, b.original.displayName),
      cell: ({ row }) => (
        <MemberIdentity
          member={row.original}
          showSelfBadge={canManage && row.original.userId === viewerId}
        />
      ),
    },
    {
      id: "papel",
      header: "Papel",
      accessorFn: (member) => member.role,
      enableSorting: canManage,
      sortFn: (a, b) =>
        ROLE_ORDER[a.original.role] - ROLE_ORDER[b.original.role],
      cell: ({ row }) => <RoleCell role={row.original.role} />,
    },
    {
      id: "contato",
      header: () => <span className="sr-only sm:not-sr-only">Contato</span>,
      enableSorting: false,
      cell: ({ row }) => <MemberContact member={row.original} />,
    },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <MemberActions
          storeId={storeId}
          member={row.original}
          isSelf={row.original.userId === viewerId}
          canManageTeam={canManage}
        />
      ),
    },
  ];
  const table = useDataTable({
    data: shown,
    columns,
    sort,
    onSortChange: (next) => set({ sort: next }),
    page: clampPage(page, shown.length),
    onPageChange: (next) => set({ page: next }),
  });
  return (
    <>
      {canManage && (
        <SearchInput
          id="members-search"
          label="Buscar membros"
          value={query}
          onChange={(value) => set({ query: value })}
        />
      )}
      <DataTable
        table={table}
        empty={
          query && (
            <p className="text-sm text-muted">{`Ninguém encontrado com "${query}".`}</p>
          )
        }
      />
    </>
  );
}

function InvitesTable({
  storeId,
  invites,
}: {
  storeId: string;
  invites: PendingInvite[];
}) {
  const [{ query, sort, page }, set] = useTableUrlState(
    invitesUrlState,
    invites.length,
  );
  const shown = invites.filter(
    (invite) => !query || matchesSearch(invite.email, query),
  );
  const columns: DataTableColumns<PendingInvite> = [
    {
      id: "email",
      header: "E-mail",
      enableSorting: false,
      cell: ({ row }) => <InviteIdentity invite={row.original} />,
    },
    {
      id: "papel",
      header: "Papel",
      enableSorting: false,
      cell: ({ row }) => <RoleCell role={row.original.role} />,
    },
    {
      id: "validade",
      header: "Validade",
      accessorFn: (invite) => invite.expiresAt,
      sortFn: (a, b) =>
        Date.parse(a.original.expiresAt) - Date.parse(b.original.expiresAt),
      cell: ({ row }) => (
        <span className="hidden text-sm text-muted sm:inline">
          Vale até {formatDate(row.original.expiresAt)}
        </span>
      ),
    },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <InviteActions storeId={storeId} invite={row.original} />
      ),
    },
  ];
  const table = useDataTable({
    data: shown,
    columns,
    sort,
    onSortChange: (next) => set({ sort: next }),
    page: clampPage(page, shown.length),
    onPageChange: (next) => set({ page: next }),
  });
  return (
    <>
      <SearchInput
        id="invites-search"
        label="Buscar convites"
        value={query}
        onChange={(value) => set({ query: value })}
      />
      <DataTable
        table={table}
        empty={
          query && (
            <p className="text-sm text-muted">{`Nenhum convite com "${query}".`}</p>
          )
        }
      />
    </>
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
        {(canManage || members.length > 0) && (
          <MembersTable
            storeId={storeId}
            viewerId={viewerId}
            members={members}
            canManage={canManage}
          />
        )}
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
          {invites.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface px-5 py-4 text-sm text-muted">
              Nenhum convite pendente. Quem você convidar aparece aqui até
              aceitar.
            </p>
          ) : (
            <InvitesTable storeId={storeId} invites={invites} />
          )}
        </section>
      )}
    </div>
  );
}
