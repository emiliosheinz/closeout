import { render, screen } from "@testing-library/react";
import { PanelLayout } from "@/_app/admin-panel/panel-layout";
import { requireMember } from "@/entities/session/index.server";

jest.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
jest.mock("@/entities/session/index.server", () => ({
  ...jest.requireActual("@/entities/session/index.server"),
  requireMember: jest.fn(),
}));

const renderAs = async (role: "owner" | "admin" | "seller") => {
  (requireMember as jest.Mock).mockResolvedValue({
    store: { name: "Brechó da Bia", slug: "brecho" },
    role,
  });
  render(await PanelLayout({ children: <p>conteúdo</p> }));
};

describe("panel layout", () => {
  it.each([
    "owner",
    "admin",
  ] as const)("shows %s the Loja link", async (role) => {
    await renderAs(role);
    expect(screen.getByRole("link", { name: "Loja" })).toBeInTheDocument();
  });

  it("hides the Loja link from a seller", async () => {
    await renderAs("seller");
    expect(screen.queryByRole("link", { name: "Loja" })).toBeNull();
    expect(screen.getByRole("link", { name: "Equipe" })).toBeInTheDocument();
  });
});
