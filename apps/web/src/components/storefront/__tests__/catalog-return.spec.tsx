import { render, screen } from "@testing-library/react";
import { BackToCatalog, RememberCatalogView } from "../catalog-return";

describe("returning to the catalog", () => {
  beforeEach(() => sessionStorage.clear());

  it("goes back to the search and filters the visitor was browsing", () => {
    render(<RememberCatalogView href="/?q=mesa&pagina=2" />);
    render(<BackToCatalog />);
    expect(
      screen.getByRole("link", { name: "Voltar ao catálogo" }),
    ).toHaveAttribute("href", "/?q=mesa&pagina=2");
  });

  it("goes to the plain catalog when the item was opened directly", () => {
    render(<BackToCatalog />);
    expect(
      screen.getByRole("link", { name: "Voltar ao catálogo" }),
    ).toHaveAttribute("href", "/");
  });
});
