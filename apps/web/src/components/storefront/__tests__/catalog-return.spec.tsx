import { render, screen } from "@testing-library/react";
import { BackToCatalog, RememberCatalogView } from "../catalog-return";

describe("returning to the catalog", () => {
  beforeEach(() => sessionStorage.clear());

  const backLink = () =>
    screen.getByRole("link", { name: "Voltar ao catálogo" });

  it("goes back to the search and filters the visitor was browsing", () => {
    render(
      <RememberCatalogView href="/store/nosso-desapego?q=mesa&pagina=2" />,
    );
    render(<BackToCatalog storeSlug="nosso-desapego" />);
    expect(backLink()).toHaveAttribute(
      "href",
      "/store/nosso-desapego?q=mesa&pagina=2",
    );
  });

  it("goes to the plain catalog when the item was opened directly", () => {
    render(<BackToCatalog storeSlug="loja-da-bia" />);
    expect(backLink()).toHaveAttribute("href", "/store/loja-da-bia");
  });

  it("ignores a view remembered from another store", () => {
    render(<RememberCatalogView href="/store/nosso-desapego?q=mesa" />);
    render(<BackToCatalog storeSlug="loja-da-bia" />);
    expect(backLink()).toHaveAttribute("href", "/store/loja-da-bia");
  });

  it("ignores a remembered store whose slug only starts the same", () => {
    render(<RememberCatalogView href="/store/loja-da-bia-2?q=mesa" />);
    render(<BackToCatalog storeSlug="loja-da-bia" />);
    expect(backLink()).toHaveAttribute("href", "/store/loja-da-bia");
  });
});
