import { dehydrate, QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { inviteKeys, type PendingInvite } from "@/entities/invite";
import { memberKeys, type TeamMember } from "@/entities/member";
import { renderWithFeedback as renderWithProviders } from "@/test/feedback-harness";
import { TeamView } from "../team-view";

const Nuqs = withNuqsTestingAdapter();

function renderWithFeedback(
  ui: React.ReactNode,
  state?: Parameters<typeof renderWithProviders>[1],
) {
  return renderWithProviders(<Nuqs>{ui}</Nuqs>, state);
}

let members: TeamMember[] = [];
let invites: PendingInvite[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

/** A tiny API: lists reflect what the writes did, like the real server. */
function stubApi(
  overrides: (method: string, path: string) => Response | undefined = () =>
    undefined,
) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(url).replace("/api/v1", "");
    const custom = overrides(method, path);
    if (custom) return custom;
    if (method === "GET" && path === "/stores/store/members")
      return Response.json({ items: members });
    if (method === "GET" && path === "/stores/store/invites")
      return Response.json({ items: invites });
    const removed = path.match(/^\/stores\/store\/members\/(.+)$/);
    if (method === "DELETE" && removed)
      members = members.filter((m) => m.userId !== removed[1]);
    const revoked = path.match(/^\/stores\/store\/invites\/(.+)$/);
    if (method === "DELETE" && revoked)
      invites = invites.filter((i) => i.id !== revoked[1]);
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const apiCalls = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith("/api/v1"))
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      method: (init as RequestInit | undefined)?.method ?? "GET",
      body: (init as RequestInit | undefined)?.body,
    }))
    .filter((call) => call.method !== "GET");

afterEach(() => vi.unstubAllGlobals());

const member = (
  userId: string,
  displayName: string,
  role: TeamMember["role"],
  whatsappNumber: string | null = "5511988887777",
): TeamMember => ({
  userId,
  name: displayName,
  email: `${userId}@loja.test`,
  role,
  sellerId: `seller-${userId}`,
  displayName,
  whatsappNumber,
  avatarUrl: null,
  listingCount: 2,
});

const team = [
  member("ana", "Ana", "owner"),
  member("bia", "Bia", "admin"),
  member("caio", "Caio", "seller", null),
];

const rowOf = (name: string) => {
  const row = screen
    .getAllByRole("row")
    .find((tr) => within(tr).queryByText(name, { exact: true }));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
};

const openMenu = (label: string) => {
  const trigger = screen.getByRole("button", { name: label });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  return screen.findByRole("menu", { name: label });
};

describe("TeamView for a manager", () => {
  beforeEach(() => {
    members = [...team];
    invites = [
      {
        id: "inv-1",
        email: "duda@loja.test",
        role: "seller",
        expiresAt: "2026-10-30T15:00:00.000Z",
      },
    ];
    stubApi();
  });

  const renderManager = () => {
    const seeded = new QueryClient();
    seeded.setQueryData(memberKeys.list("store"), { items: members });
    seeded.setQueryData(inviteKeys.pending("store"), { items: invites });
    return renderWithFeedback(
      <TeamView storeId="store" viewerId="bia" ownRows={null} />,
      dehydrate(seeded),
    );
  };

  it("lists every member before the pending invites", () => {
    renderManager();
    const people = screen.getByRole("region", { name: "Membros" });
    const invites = screen.getByRole("region", { name: /Convites pendentes/ });
    expect(
      people.compareDocumentPosition(invites) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(people)
        .getAllByRole("row")
        .slice(1)
        .map((tr) => tr.querySelector("span.truncate")?.textContent),
    ).toEqual(["Ana", "Bia", "Caio"]);
    expect(
      within(people).getByRole("row", { name: /caio@loja\.test/ }),
    ).toBeInTheDocument();
    expect(within(people).getByText("Você")).toBeInTheDocument();
    expect(
      within(invites).getByRole("heading", { name: "Convites pendentes (1)" }),
    ).toBeInTheDocument();
    expect(within(invites).getByText("duda@loja.test")).toBeInTheDocument();
    expect(
      within(invites).getByText("Vendedor(a), vale até 30 de outubro de 2026"),
    ).toBeInTheDocument();
  });

  it("shows the WhatsApp number of reachable members and flags the others", () => {
    renderManager();
    expect(
      within(rowOf("Ana")).getByText("+5511988887777"),
    ).toBeInTheDocument();
    expect(within(rowOf("Ana")).queryByText("Sem WhatsApp")).toBeNull();
    expect(within(rowOf("Caio")).getByText("Sem WhatsApp")).toBeInTheDocument();
  });

  it("offers removal only for other non-owner members", async () => {
    renderManager();
    const forCaio = await openMenu("Ações para Caio");
    expect(
      within(forCaio).getByRole("menuitem", { name: "Editar" }),
    ).toBeInTheDocument();
    expect(
      within(forCaio).getByRole("menuitem", { name: "Remover" }),
    ).toBeInTheDocument();

    for (const name of ["Ana", "Bia"]) {
      const menu = await openMenu(`Ações para ${name}`);
      expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
      expect(
        within(menu).getByRole("menuitem", { name: "Editar" }),
      ).toBeInTheDocument();
    }
  });

  it("keeps an open actions menu open when the member list refetches", async () => {
    const { client } = renderManager();
    await openMenu("Ações para Caio");
    members = members.map((m) =>
      m.userId === "ana" ? { ...m, listingCount: 5 } : m,
    );

    await act(() =>
      client.refetchQueries({ queryKey: memberKeys.list("store") }),
    );

    await waitFor(() =>
      expect(
        client.getQueryData<{ items: TeamMember[] }>(memberKeys.list("store"))
          ?.items[0]?.listingCount,
      ).toBe(5),
    );
    expect(
      screen.getByRole("menu", { name: "Ações para Caio" }),
    ).toBeInTheDocument();
  });

  it("removes a member after confirming and drops their row", async () => {
    renderManager();
    expect(screen.getByRole("row", { name: /caio@loja\.test/ })).toBeVisible();
    fireEvent.click(
      within(await openMenu("Ações para Caio")).getByRole("menuitem", {
        name: "Remover",
      }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remover Caio da equipe?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remover da equipe" }),
    );
    expect(await screen.findByText("Caio saiu da equipe.")).toBeVisible();
    expect(apiCalls()).toEqual([
      { url: "/stores/store/members/caio", method: "DELETE", body: undefined },
    ]);
    await waitFor(() =>
      expect(screen.queryAllByText("caio@loja.test")).toHaveLength(0),
    );
  });

  it("revokes the last invite and leaves the heading without a number", async () => {
    renderManager();
    expect(
      screen.getByRole("heading", { name: "Convites pendentes (1)" }),
    ).toBeVisible();
    fireEvent.click(
      within(
        await openMenu("Ações para o convite de duda@loja.test"),
      ).getByRole("menuitem", { name: "Revogar" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Revogar convite" }),
    );

    expect(await screen.findByText("Convite revogado.")).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "Convites pendentes" }),
    ).toBeVisible();
    expect(screen.getByText(/Nenhum convite pendente/)).toBeVisible();
  });

  it("edits with a role toggle only for manageable members", async () => {
    renderManager();
    fireEvent.click(
      within(await openMenu("Ações para Caio")).getByRole("menuitem", {
        name: "Editar",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: /Caio/ });
    const role = within(dialog).getByRole("radiogroup", {
      name: "Papel de Caio",
    });
    expect(
      within(role).getByRole("radio", { name: "Vendedor(a)" }),
    ).toBeChecked();
    expect(
      within(role).getByRole("radio", { name: "Admin" }),
    ).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    for (const name of ["Ana", "Bia"]) {
      fireEvent.click(
        within(await openMenu(`Ações para ${name}`)).getByRole("menuitem", {
          name: "Editar",
        }),
      );
      const own = await screen.findByRole("dialog", {
        name: new RegExp(name),
      });
      expect(within(own).queryByRole("radiogroup")).toBeNull();
      fireEvent.click(within(own).getByRole("button", { name: "Cancelar" }));
    }
  });

  it("saves the profile and the new role through the API", async () => {
    renderManager();
    fireEvent.click(
      within(await openMenu("Ações para Caio")).getByRole("menuitem", {
        name: "Editar",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: /Caio/ });
    fireEvent.change(within(dialog).getByLabelText("WhatsApp"), {
      target: { value: "+55 21 97777-1234" },
    });
    fireEvent.click(within(dialog).getByText("Admin"));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(apiCalls().map(({ url, method }) => [method, url])).toEqual([
      ["PATCH", "/stores/store/sellers/seller-caio"],
      ["PATCH", "/stores/store/members/caio"],
    ]);
    expect(JSON.parse(apiCalls()[0]?.body as string)).toEqual({
      displayName: "Caio",
      whatsappNumber: "+55 21 97777-1234",
    });
    expect(JSON.parse(apiCalls()[1]?.body as string)).toEqual({
      role: "admin",
    });
  });

  it("shows the API message and keeps the dialog open when saving fails", async () => {
    stubApi((method) =>
      method === "PATCH"
        ? Response.json(
            { message: "Informe o WhatsApp com o código do país" },
            { status: 400 },
          )
        : undefined,
    );
    renderManager();
    fireEvent.click(
      within(await openMenu("Ações para Caio")).getByRole("menuitem", {
        name: "Editar",
      }),
    );
    const dialog = await screen.findByRole("dialog", { name: /Caio/ });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Informe o WhatsApp com o código do país",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers a new link or revocation for a pending invite", async () => {
    renderManager();
    const menu = await openMenu("Ações para o convite de duda@loja.test");
    expect(
      within(menu).getByRole("menuitem", { name: "Gerar novo link" }),
    ).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Revogar" }));
    expect(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Revogar convite",
      }),
    ).toBeInTheDocument();
  });

  it("says so when no invite is pending", () => {
    invites = [];
    renderManager();
    expect(screen.getByText(/Nenhum convite pendente/)).toBeInTheDocument();
  });
});

describe("TeamView for a seller", () => {
  it("shows only their own row, with edit as the single action", async () => {
    stubApi();
    renderWithFeedback(
      <TeamView
        storeId="store"
        viewerId="caio"
        ownRows={[member("caio", "Caio", "seller")]}
      />,
    );
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
    expect(
      screen.getByRole("region", { name: "Seu contato" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Caio")).toBeInTheDocument();
    expect(screen.queryByText("Você")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Convidar pessoas" }),
    ).toBeNull();
    expect(screen.queryByText(/Convites pendentes/)).toBeNull();
    const menu = await openMenu("Ações para Caio");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(1);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: /Caio/ });
    expect(within(dialog).getByLabelText("Nome na loja")).toHaveValue("Caio");
    expect(within(dialog).getByLabelText("WhatsApp")).toHaveValue(
      "+5511988887777",
    );
    expect(within(dialog).queryByRole("radiogroup")).toBeNull();
  });
});

describe("member avatar", () => {
  const renderOne = (overrides: Partial<TeamMember>) => {
    stubApi();
    return renderWithFeedback(
      <TeamView
        storeId="store"
        viewerId="caio"
        ownRows={[{ ...member("caio", "Caio", "seller"), ...overrides }]}
      />,
    );
  };

  it("shows the photo when there is one", () => {
    const { container } = renderOne({
      avatarUrl: "https://cdn.test/caio.webp",
    });
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.test/caio.webp",
    );
  });

  it("shows the member's initials instead of a photo when there is none", () => {
    const { container } = renderOne({
      avatarUrl: null,
      displayName: "Caio Prado Lima",
    });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("CL")).toBeInTheDocument();
  });
});
