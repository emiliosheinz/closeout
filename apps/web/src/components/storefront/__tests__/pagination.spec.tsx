import { render, screen } from "@testing-library/react";
import { parseCatalogParams } from "@/lib/catalog/params";
import { Pagination } from "../pagination";

describe("Pagination", () => {
  it("links to the next page keeping the active filters", () => {
    render(
      <Pagination
        filters={parseCatalogParams({ categoria: "moveis" })}
        total={50}
        pageSize={24}
      />,
    );
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver mais itens" }),
    ).toHaveAttribute("href", "/?categoria=moveis&pagina=2");
    expect(screen.queryByRole("link", { name: "Anteriores" })).toBeNull();
  });

  it("links back from the last page and hides itself for a single page", () => {
    const { rerender } = render(
      <Pagination
        filters={parseCatalogParams({ pagina: "3" })}
        total={50}
        pageSize={24}
      />,
    );
    expect(screen.getByRole("link", { name: "Anteriores" })).toHaveAttribute(
      "href",
      "/?pagina=2",
    );
    expect(screen.queryByRole("link", { name: "Ver mais itens" })).toBeNull();

    rerender(
      <Pagination filters={parseCatalogParams({})} total={5} pageSize={24} />,
    );
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
