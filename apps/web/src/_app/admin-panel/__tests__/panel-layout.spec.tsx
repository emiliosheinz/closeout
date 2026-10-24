import { render, screen } from "@testing-library/react";
import type { Mock } from "vitest";
import { PanelLayout } from "@/_app/admin-panel/panel-layout";
import { requireMember } from "@/entities/session/index.server";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/entities/session/index.server", async () => ({
  ...(await vi.importActual("@/entities/session/index.server")),
  requireMember: vi.fn(),
}));

const renderAs = async (role: "owner" | "admin" | "seller") => {
  (requireMember as Mock).mockResolvedValue({
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
