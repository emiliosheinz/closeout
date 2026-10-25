import { dehydrate, QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { inviteKeys, type PendingInvite } from "@/entities/invite";
import { memberKeys, type TeamMember } from "@/entities/member";
import { renderWithFeedback } from "@/test/feedback-harness";
import { TeamView } from "../team-view";

function member(
  displayName: string,
  role: TeamMember["role"],
  email = `${displayName.toLowerCase()}@loja.test`,
): TeamMember {
  return {
    userId: email,
    name: displayName,
    email,
    role,
    sellerId: `seller-${email}`,
    displayName,
    whatsappNumber: null,
    avatarUrl: null,
    listingCount: 0,
  };
}

const invite = (email: string, expiresAt: string): PendingInvite => ({
  id: email,
  email,
  role: "seller",
  expiresAt,
});

// API order, deliberately not alphabetical, nor by role.
const team = [
  member("Zeca", "seller"),
  member("Ana", "owner"),
  member("José", "admin", "j.silva@loja.test"),
  member("Ágata", "seller", "gata@loja.test"),
  member("Bia", "admin"),
];
const teamNames = team.map((m) => m.displayName);

const pending = [
  invite("carla@loja.test", "2026-11-20T12:00:00.000Z"),
  invite("Duda@loja.test", "2026-11-05T12:00:00.000Z"),
  invite("bruno@loja.test", "2026-11-12T12:00:00.000Z"),
];
const inviteEmails = pending.map((i) => i.email);

function renderTeam({
  members = team,
  invites = pending,
  search = "",
}: {
  members?: TeamMember[];
  invites?: PendingInvite[];
  search?: string;
} = {}) {
  const onUrlUpdate = vi.fn();
  const seeded = new QueryClient();
  seeded.setQueryData(memberKeys.list("store"), { items: members });
  seeded.setQueryData(inviteKeys.pending("store"), { items: invites });
  const Nuqs = withNuqsTestingAdapter({
    searchParams: search,
    onUrlUpdate,
    hasMemory: true,
  });
  renderWithFeedback(
    <Nuqs>
      <TeamView storeId="store" viewerId="zeca" ownRows={null} />
    </Nuqs>,
    dehydrate(seeded),
  );
  const lastUrl = () =>
    new URLSearchParams(onUrlUpdate.mock.lastCall?.[0].queryString);
  return { lastUrl };
}

const membersRegion = () => screen.getByRole("region", { name: /pessoas?$/ });
const invitesRegion = () =>
  screen.getByRole("region", { name: /Convites pendentes/ });

/** Row labels in display order, found by the exact name or email in each row. */
function order(region: HTMLElement, labels: string[]) {
  return within(region)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      labels.find((label) => within(row).queryByText(label, { exact: true })),
    );
}

const sortBy = (region: HTMLElement, column: string) =>
  fireEvent.click(within(region).getByRole("button", { name: column }));

describe("members table", () => {
  it("keeps the API order until a sort is chosen", async () => {
    renderTeam();
    expect(order(membersRegion(), teamNames)).toEqual(teamNames);
  });

  it("sorts by name in pt-BR order and toggles on repeat", async () => {
    const { lastUrl } = renderTeam();
    sortBy(membersRegion(), "Nome");
    expect(order(membersRegion(), teamNames)).toEqual([
      "Ágata",
      "Ana",
      "Bia",
      "José",
      "Zeca",
    ]);
    await waitFor(() =>
      expect(lastUrl().get("membros-ordem")).toBe("nome-asc"),
    );
    sortBy(membersRegion(), "Nome");
    expect(order(membersRegion(), teamNames)).toEqual([
      "Zeca",
      "José",
      "Bia",
      "Ana",
      "Ágata",
    ]);
    await waitFor(() =>
      expect(lastUrl().get("membros-ordem")).toBe("nome-desc"),
    );
  });

  it("sorts by role as owner, admin, seller and toggles on repeat", async () => {
    renderTeam();
    sortBy(membersRegion(), "Papel");
    expect(order(membersRegion(), teamNames)).toEqual([
      "Ana",
      "José",
      "Bia",
      "Zeca",
      "Ágata",
    ]);
    sortBy(membersRegion(), "Papel");
    expect(order(membersRegion(), teamNames).slice(-1)).toEqual(["Ana"]);
  });

  it("restores the sort from the URL", async () => {
    renderTeam({ search: "?membros-ordem=nome-desc" });
    expect(order(membersRegion(), teamNames)[0]).toBe("Zeca");
  });

  it("searches names ignoring case and accents", async () => {
    renderTeam({ search: "?membros-q=JOSE" });
    expect(order(membersRegion(), teamNames)).toEqual(["José"]);
  });

  it("searches emails", async () => {
    renderTeam({ search: "?membros-q=ana@" });
    expect(order(membersRegion(), teamNames)).toEqual(["Ana"]);
  });

  it("writes the typed search to the URL", async () => {
    const { lastUrl } = renderTeam();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar membros" }),
      {
        target: { value: "bia" },
      },
    );
    await waitFor(() => expect(lastUrl().get("membros-q")).toBe("bia"));
    expect(order(membersRegion(), teamNames)).toEqual(["Bia"]);
  });

  it("says so when nobody matches", async () => {
    renderTeam({ search: "?membros-q=zzz" });
    expect(
      within(membersRegion()).getByText('Ninguém encontrado com "zzz".'),
    ).toBeVisible();
  });

  it("has no role filter", async () => {
    renderTeam();
    expect(within(membersRegion()).queryByRole("combobox")).toBeNull();
  });

  it("paginates at 20 rows", async () => {
    const many = Array.from({ length: 21 }, (_, i) =>
      member(`Pessoa ${String(i).padStart(2, "0")}`, "seller"),
    );
    const { lastUrl } = renderTeam({ members: many });
    expect(within(membersRegion()).getAllByRole("row")).toHaveLength(21);
    expect(within(membersRegion()).getByText("Página 1 de 2")).toBeVisible();
    fireEvent.click(
      within(membersRegion()).getByRole("button", { name: "Próxima página" }),
    );
    await waitFor(() => expect(lastUrl().get("membros-pagina")).toBe("2"));
    expect(within(membersRegion()).getAllByRole("row")).toHaveLength(2);
  });
});

describe("invites table", () => {
  it("orders by expiry ascending by default and toggles", async () => {
    const { lastUrl } = renderTeam();
    expect(order(invitesRegion(), inviteEmails)).toEqual([
      "Duda@loja.test",
      "bruno@loja.test",
      "carla@loja.test",
    ]);
    sortBy(invitesRegion(), "Validade");
    expect(order(invitesRegion(), inviteEmails)).toEqual([
      "carla@loja.test",
      "bruno@loja.test",
      "Duda@loja.test",
    ]);
    await waitFor(() =>
      expect(lastUrl().get("convites-ordem")).toBe("validade-desc"),
    );
  });

  it("searches email ignoring case", async () => {
    renderTeam({ search: "?convites-q=DUDA" });
    expect(order(invitesRegion(), inviteEmails)).toEqual(["Duda@loja.test"]);
  });

  it("says so when no invite matches", async () => {
    renderTeam({ search: "?convites-q=zzz" });
    expect(
      within(invitesRegion()).getByText('Nenhum convite com "zzz".'),
    ).toBeVisible();
  });
});

describe("independent table state", () => {
  const convites = "?convites-q=carla&convites-ordem=validade-desc";

  it("leaves the invites untouched when the members table changes", async () => {
    const { lastUrl } = renderTeam({ search: convites });
    sortBy(membersRegion(), "Nome");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar membros" }),
      {
        target: { value: "ana" },
      },
    );
    const url = { get: (key: string) => lastUrl().get(key) };
    await waitFor(() => expect(url.get("membros-q")).toBe("ana"));
    await waitFor(() => expect(url.get("convites-q")).toBe("carla"));
    await waitFor(() =>
      expect(url.get("convites-ordem")).toBe("validade-desc"),
    );
    await waitFor(() => expect(url.get("convites-pagina")).toBeNull());
    expect(order(invitesRegion(), inviteEmails)).toEqual(["carla@loja.test"]);
  });

  it("leaves the members untouched when the invites table changes", async () => {
    const { lastUrl } = renderTeam({
      search: "?membros-q=a&membros-ordem=nome-desc",
    });
    const before = order(membersRegion(), teamNames);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar convites" }),
      { target: { value: "bruno" } },
    );
    sortBy(invitesRegion(), "Validade");
    const url = { get: (key: string) => lastUrl().get(key) };
    await waitFor(() => expect(url.get("convites-q")).toBe("bruno"));
    await waitFor(() => expect(url.get("membros-q")).toBe("a"));
    await waitFor(() => expect(url.get("membros-ordem")).toBe("nome-desc"));
    expect(order(membersRegion(), teamNames)).toEqual(before);
  });
});

describe("page state", () => {
  const manyMembers = Array.from({ length: 21 }, (_, i) =>
    member(`Pessoa ${String(i).padStart(2, "0")}`, "seller"),
  );
  const manyInvites = Array.from({ length: 21 }, (_, i) =>
    invite(
      `convite${String(i).padStart(2, "0")}@loja.test`,
      `2026-11-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`,
    ),
  );
  const rowCount = (region: HTMLElement) =>
    within(region).getAllByRole("row").length - 1;

  it("clamps the members page to the filtered rows", () => {
    renderTeam({
      members: manyMembers,
      search: "?membros-q=pessoa%2005&membros-pagina=2",
    });
    expect(rowCount(membersRegion())).toBe(1);
    expect(within(membersRegion()).getByText("Pessoa 05")).toBeVisible();
  });

  it("clamps the invites page to the filtered rows", () => {
    renderTeam({
      invites: manyInvites,
      search: "?convites-q=convite05&convites-pagina=2",
    });
    expect(rowCount(invitesRegion())).toBe(1);
    expect(
      within(invitesRegion()).getByText("convite05@loja.test"),
    ).toBeVisible();
  });

  it("returns members to page 1 when the sort changes", async () => {
    const { lastUrl } = renderTeam({
      members: manyMembers,
      search: "?membros-pagina=2",
    });
    expect(rowCount(membersRegion())).toBe(1);
    sortBy(membersRegion(), "Nome");
    expect(rowCount(membersRegion())).toBe(20);
    await waitFor(() =>
      expect(lastUrl().get("membros-ordem")).toBe("nome-asc"),
    );
    expect(lastUrl().has("membros-pagina")).toBe(false);
  });

  it("returns members to page 1 when the search changes", async () => {
    const { lastUrl } = renderTeam({
      members: manyMembers,
      search: "?membros-pagina=2",
    });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar membros" }),
      {
        target: { value: "pessoa" },
      },
    );
    expect(rowCount(membersRegion())).toBe(20);
    await waitFor(() => expect(lastUrl().get("membros-q")).toBe("pessoa"));
    expect(lastUrl().has("membros-pagina")).toBe(false);
  });

  it("returns invites to page 1 when the sort changes", async () => {
    const { lastUrl } = renderTeam({
      invites: manyInvites,
      search: "?convites-pagina=2",
    });
    expect(rowCount(invitesRegion())).toBe(1);
    sortBy(invitesRegion(), "Validade");
    expect(rowCount(invitesRegion())).toBe(20);
    await waitFor(() =>
      expect(lastUrl().get("convites-ordem")).toBe("validade-desc"),
    );
    expect(lastUrl().has("convites-pagina")).toBe(false);
  });

  it("returns invites to page 1 when the search changes", async () => {
    const { lastUrl } = renderTeam({
      invites: manyInvites,
      search: "?convites-pagina=2",
    });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Buscar convites" }),
      { target: { value: "convite" } },
    );
    expect(rowCount(invitesRegion())).toBe(20);
    await waitFor(() => expect(lastUrl().get("convites-q")).toBe("convite"));
    expect(lastUrl().has("convites-pagina")).toBe(false);
  });
});

describe("a seller's team", () => {
  it("offers no search, sort or pagination controls", async () => {
    renderTeamAsSeller();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Nome" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Papel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Próxima página" })).toBeNull();
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
  });
});

function renderTeamAsSeller() {
  const Nuqs = withNuqsTestingAdapter();
  renderWithFeedback(
    <Nuqs>
      <TeamView
        storeId="store"
        viewerId="zeca"
        ownRows={[member("Zeca", "seller")]}
      />
    </Nuqs>,
  );
}
