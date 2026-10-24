import { render, screen, within } from "@testing-library/react";
import { AdminNav } from "@/_app/admin-panel/admin-nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const linkNames = () =>
  within(screen.getByRole("navigation", { name: "Administração" }))
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("AdminNav", () => {
  it("shows a seller listings and team, without the store settings", () => {
    render(<AdminNav storeName="Loja" storeSlug="loja" managesStore={false} />);
    expect(linkNames()).toEqual(["Anúncios", "Equipe"]);
  });

  it("shows owners and admins the store settings too", () => {
    render(<AdminNav storeName="Loja" storeSlug="loja" managesStore />);
    expect(linkNames()).toEqual(["Anúncios", "Equipe", "Loja"]);
    expect(screen.getByRole("link", { name: "Equipe" })).toHaveAttribute(
      "href",
      "/admin/equipe",
    );
  });
});
