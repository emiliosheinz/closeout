import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { MockedFunction } from "vitest";
import type { TeamMember } from "@/entities/member";
import { ApiError, api, apiParsed } from "@/shared/api";
import { TeamView } from "../team-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/shared/api", async () => ({
  ...(await vi.importActual("@/shared/api")),
  api: vi.fn(),
  apiParsed: vi.fn(),
}));

const apiMock = api as MockedFunction<typeof api>;
const parsedMock = apiParsed as MockedFunction<typeof apiParsed>;

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
    .getAllByRole("listitem")
    .find((li) => within(li).queryByText(name, { exact: true }));
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
    apiMock.mockReset();
    parsedMock.mockReset();
  });

  const renderManager = () =>
    render(
      <TeamView
        storeId="store"
        viewerId="bia"
        members={team}
        invites={[
          {
            id: "inv-1",
            email: "duda@loja.test",
            role: "seller",
            expiresAt: "2026-10-30T15:00:00.000Z",
          },
        ]}
      />,
    );

  it("lists every member before the pending invites", () => {
    renderManager();
    const people = screen.getByRole("region", { name: "3 pessoas" });
    const invites = screen.getByRole("region", { name: /Convites pendentes/ });
    expect(
      people.compareDocumentPosition(invites) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(people)
        .getAllByRole("listitem")
        .map((li) => li.querySelector("span.truncate")?.textContent),
    ).toEqual(["Ana", "Bia", "Caio"]);
    expect(within(people).getByText("caio@loja.test")).toBeInTheDocument();
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

  it("removes a member after confirming", async () => {
    apiMock.mockResolvedValue(undefined);
    renderManager();
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
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "DELETE",
        "/stores/store/members/caio",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
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
    apiMock.mockResolvedValue(undefined);
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
    expect(apiMock).toHaveBeenCalledWith(
      "PATCH",
      "/stores/store/sellers/seller-caio",
      {
        displayName: "Caio",
        whatsappNumber: "+55 21 97777-1234",
      },
    );
    expect(apiMock).toHaveBeenCalledWith(
      "PATCH",
      "/stores/store/members/caio",
      {
        role: "admin",
      },
    );
  });

  it("shows the API message and keeps the dialog open when saving fails", async () => {
    apiMock.mockRejectedValue(
      new ApiError(400, "Informe o WhatsApp com o código do país"),
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

  it("invites people by email with a role defaulting to seller", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas" }));
    const dialog = screen.getByRole("dialog", { name: "Convidar pessoas" });
    expect(
      within(dialog).getByLabelText("E-mail da pessoa"),
    ).toBeInTheDocument();
    const role = within(dialog).getByRole("radiogroup", { name: "Papel" });
    expect(
      within(role).getByRole("radio", { name: "Vendedor(a)" }),
    ).toBeChecked();
    expect(
      within(role).getByRole("radio", { name: "Admin" }),
    ).not.toBeChecked();
    expect(
      within(dialog).getByRole("button", { name: "Criar convite" }),
    ).toBeInTheDocument();
  });

  it("shows the invite link after creating an invite", async () => {
    parsedMock.mockResolvedValue({
      parsed: true,
      data: {
        invite: { id: "inv-2", email: "eva@loja.test", role: "seller" },
        link: "https://closeout.test/invite/xyz",
      },
    });
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas" }));
    fireEvent.change(screen.getByLabelText("E-mail da pessoa"), {
      target: { value: "eva@loja.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));
    expect(
      await screen.findByRole("dialog", { name: "Convite para eva@loja.test" }),
    ).toBeInTheDocument();
    expect(parsedMock).toHaveBeenCalledWith(
      "POST",
      "/stores/store/invites",
      { email: "eva@loja.test", role: "seller" },
      expect.anything(),
    );
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
    render(
      <TeamView storeId="store" viewerId="bia" members={team} invites={[]} />,
    );
    expect(screen.getByText(/Nenhum convite pendente/)).toBeInTheDocument();
  });
});

describe("TeamView for a seller", () => {
  it("shows only their own row, with edit as the single action", async () => {
    render(
      <TeamView
        storeId="store"
        viewerId="caio"
        members={[member("caio", "Caio", "seller")]}
        invites={null}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
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
  const renderOne = (overrides: Partial<TeamMember>) =>
    render(
      <TeamView
        storeId="store"
        viewerId="caio"
        members={[{ ...member("caio", "Caio", "seller"), ...overrides }]}
        invites={null}
      />,
    );

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
