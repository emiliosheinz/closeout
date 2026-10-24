import { render, screen, within } from "@testing-library/react";
import type { TeamMember } from "@/lib/admin/types";
import { TeamView } from "../team/team-view";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

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

describe("TeamView for a manager", () => {
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
    const people = screen.getByRole("region", { name: /Pessoas/ });
    const invites = screen.getByRole("region", { name: "Convidar" });
    expect(
      people.compareDocumentPosition(invites) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(people)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Ana", "Bia", "Caio"]);
    expect(within(people).getByText("caio@loja.test")).toBeInTheDocument();
    expect(within(people).getByText("Dono(a)")).toBeInTheDocument();
    expect(within(people).getByText(/^Sem WhatsApp/)).toBeInTheDocument();
    expect(within(invites).getByText("duda@loja.test")).toBeInTheDocument();
    expect(
      within(invites).getByText("Vendedor(a), vale até 30 de outubro de 2026"),
    ).toBeInTheDocument();
  });

  it("offers role and removal controls only for other non-owner members", () => {
    renderManager();
    expect(screen.getByRole("combobox", { name: "Papel de Caio" })).toHaveValue(
      "seller",
    );
    expect(screen.queryByRole("combobox", { name: "Papel de Ana" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Papel de Bia" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remover" })).toHaveLength(1);
  });

  it("invites people by email with a role", () => {
    renderManager();
    expect(screen.getByLabelText("E-mail da pessoa")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Vendedor\(a\)/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Admin/ })).not.toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Gerar novo link para duda@loja.test",
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
  it("shows only their own editable card, without invite or member controls", () => {
    render(
      <TeamView
        storeId="store"
        viewerId="caio"
        members={[member("caio", "Caio", "seller")]}
        invites={null}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByLabelText("Nome que aparece na loja")).toHaveValue(
      "Caio",
    );
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("+5511988887777");
    expect(
      screen.getByRole("button", { name: "Salvar contato" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    expect(screen.queryByLabelText("E-mail da pessoa")).toBeNull();
    expect(screen.queryByText(/Convites pendentes/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Seu contato" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Pessoas/ })).toBeNull();
  });
});

describe("member card contact profile", () => {
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

  it("shows a camera placeholder instead of a photo when there is none", () => {
    const { container } = renderOne({ avatarUrl: null });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the WhatsApp number of a reachable member and no warning", () => {
    renderOne({ whatsappNumber: "5511988887777" });
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("+5511988887777");
    expect(screen.queryByText(/^Sem WhatsApp/)).toBeNull();
  });

  it("warns that a member without WhatsApp has no contact button", () => {
    renderOne({ whatsappNumber: null });
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("");
    expect(
      screen.getByText(
        "Sem WhatsApp: os anúncios só desta pessoa aparecem sem botão de contato.",
      ),
    ).toBeInTheDocument();
  });
});
