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
import { InviteActions } from "@/features/invite-actions";
import { MemberActions } from "@/features/member-actions";
import { readQuery } from "@/shared/api";
import { formatDate, ROLE_LABELS } from "@/shared/lib/format";
import {
  createTableUrlState,
  useTableUrlState,
} from "@/shared/lib/table-url-state";
import { compareText, matchesSearch } from "@/shared/lib/text";
import { cn } from "@/shared/lib/utils";
import {
  DataTable,
  type DataTableColumns,
  useDataTable,
} from "@/shared/ui/data-table/data-table";
import { SearchInput } from "@/shared/ui/search-input";

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
  return <span className="text-sm text-ink-soft">{ROLE_LABELS[role]}</span>;
}

// The actions menu is the last column in both tables: it takes only its
// button's width and sits at the row's end, leaving the rest to the data. On
// phones the first column takes all the room left, and its text truncates
// there instead of widening the table (max-w-0 lets a cell shrink below its
// content).
const columnWidths =
  "[&_tr>*:last-child]:w-px [&_tr>*:last-child]:text-right max-sm:[&_td:first-child]:w-full max-sm:[&_td:first-child]:max-w-0";

// Phones show a column's content under the name or email instead, so its
// header must not keep the column wide. These go by position: Contato is the
// 3rd members column and Papel the 2nd invites column, so they depend on the
// order of the column lists below.
const hideMemberContactOnPhones =
  "max-sm:[&_th:nth-child(3)]:hidden max-sm:[&_td:nth-child(3)]:hidden";
const hideInviteRoleOnPhones =
  "max-sm:[&_th:nth-child(2)]:hidden max-sm:[&_td:nth-child(2)]:hidden";

type MemberRow = {
  member: TeamMember;
  storeId: string;
  viewerId: string;
  canManage: boolean;
};

// Cells render as components, so the columns live at module level: a new cell
// function on every render would remount the row's actions (open menus,
// dialogs, pending guards). Sorting is a column option, hence one set per mode.
function memberColumns(canManage: boolean): DataTableColumns<MemberRow> {
  return [
    {
      id: "nome",
      header: "Nome",
      accessorFn: (row) => row.member.displayName,
      enableSorting: canManage,
      sortFn: (a, b) =>
        compareText(
          a.original.member.displayName,
          b.original.member.displayName,
        ),
      cell: ({ row: { original } }) => (
        <MemberIdentity
          member={original.member}
          showSelfBadge={
            original.canManage && original.member.userId === original.viewerId
          }
        />
      ),
    },
    {
      id: "papel",
      header: "Papel",
      accessorFn: (row) => row.member.role,
      enableSorting: canManage,
      sortFn: (a, b) =>
        ROLE_ORDER[a.original.member.role] - ROLE_ORDER[b.original.member.role],
      cell: ({ row }) => <RoleCell role={row.original.member.role} />,
    },
    {
      id: "contato",
      header: () => <span className="sr-only sm:not-sr-only">Contato</span>,
      enableSorting: false,
      cell: ({ row }) => <MemberContact member={row.original.member} />,
    },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row: { original } }) => (
        <MemberActions
          storeId={original.storeId}
          member={original.member}
          isSelf={original.member.userId === original.viewerId}
          canManageTeam={original.canManage}
        />
      ),
    },
  ];
}

const managerMemberColumns = memberColumns(true);
const sellerMemberColumns = memberColumns(false);

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
  const [{ query, sort, page }, set] = useTableUrlState(membersUrlState);
  const rows: MemberRow[] = members
    .filter(
      (member) =>
        !canManage ||
        !query ||
        matchesSearch(member.displayName, query) ||
        matchesSearch(member.email, query),
    )
    .map((member) => ({ member, storeId, viewerId, canManage }));
  const table = useDataTable({
    data: rows,
    columns: canManage ? managerMemberColumns : sellerMemberColumns,
    getRowId: (row) => row.member.userId,
    sort,
    onSortChange: (next) => set({ sort: next }),
    page,
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
          className="mb-3"
        />
      )}
      <DataTable
        table={table}
        className={cn(columnWidths, hideMemberContactOnPhones)}
        empty={
          query && (
            <p className="px-4 py-8 text-center text-ink-soft">{`Ninguém encontrado com "${query}".`}</p>
          )
        }
      />
    </>
  );
}

type InviteRow = { invite: PendingInvite; storeId: string };

const inviteColumns: DataTableColumns<InviteRow> = [
  {
    id: "email",
    header: "E-mail",
    enableSorting: false,
    cell: ({ row }) => <InviteIdentity invite={row.original.invite} />,
  },
  {
    id: "papel",
    header: "Papel",
    enableSorting: false,
    cell: ({ row }) => <RoleCell role={row.original.invite.role} />,
  },
  {
    id: "validade",
    header: "Validade",
    accessorFn: (row) => row.invite.expiresAt,
    sortFn: (a, b) =>
      Date.parse(a.original.invite.expiresAt) -
      Date.parse(b.original.invite.expiresAt),
    cell: ({ row }) => (
      <span className="hidden text-sm text-muted sm:inline">
        Vale até {formatDate(row.original.invite.expiresAt)}
      </span>
    ),
  },
  {
    id: "acoes",
    header: () => <span className="sr-only">Ações</span>,
    enableSorting: false,
    cell: ({ row }) => (
      <InviteActions
        storeId={row.original.storeId}
        invite={row.original.invite}
      />
    ),
  },
];

function InvitesTable({
  storeId,
  invites,
}: {
  storeId: string;
  invites: PendingInvite[];
}) {
  const [{ query, sort, page }, set] = useTableUrlState(invitesUrlState);
  const rows: InviteRow[] = invites
    .filter((invite) => !query || matchesSearch(invite.email, query))
    .map((invite) => ({ invite, storeId }));
  const table = useDataTable({
    data: rows,
    columns: inviteColumns,
    getRowId: (row) => row.invite.id,
    sort,
    onSortChange: (next) => set({ sort: next }),
    page,
    onPageChange: (next) => set({ page: next }),
  });
  return (
    <>
      <SearchInput
        id="invites-search"
        label="Buscar convites"
        value={query}
        onChange={(value) => set({ query: value })}
        className="mb-3"
      />
      <DataTable
        table={table}
        className={cn(columnWidths, hideInviteRoleOnPhones)}
        empty={
          query && (
            <p className="px-4 py-8 text-center text-ink-soft">{`Nenhum convite com "${query}".`}</p>
          )
        }
      />
    </>
  );
}

const sectionHeading = "mb-3 text-sm font-semibold text-muted outline-none";

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
        {/* The search box and table already say what this is; the heading
            names the region and takes focus after a removal. */}
        <h2 id="team-members" tabIndex={-1} className="sr-only">
          {canManage ? "Membros" : "Seu contato"}
        </h2>
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
          <h2 id="team-invites" tabIndex={-1} className={sectionHeading}>
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
