import { fireEvent, render, screen } from "@testing-library/react";
import { FilterForm } from "@/features/catalog-filter";
import { parseCatalogParams } from "@/features/catalog-filter/model/params";
import { FiltersSheet } from "../filters-sheet";

const renderSheet = (activeCount = 0) =>
  render(
    <FiltersSheet activeCount={activeCount}>
      <FilterForm storeSlug="loja" filters={parseCatalogParams({})} />
    </FiltersSheet>,
  );

describe("filters sheet", () => {
  it("opens the filter dialog from the Filtros button", () => {
    renderSheet();
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));

    expect(
      screen.getByRole("dialog", { name: "Filtrar itens" }),
    ).toBeInTheDocument();
  });

  it("submits condition and sort to the store catalog by GET", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const dialog = screen.getByRole("dialog", { name: "Filtrar itens" });

    const form = dialog.querySelector("form");
    expect(form).toHaveAttribute("action", "/store/loja");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("radio", { name: "Como novo" })).toHaveAttribute(
      "name",
      "condition",
    );
    expect(screen.getByRole("radio", { name: "Menor preço" })).toHaveAttribute(
      "name",
      "sort",
    );
    expect(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    ).toHaveAttribute("type", "submit");
  });

  it("shows how many filters are active on the button", () => {
    renderSheet(2);
    expect(screen.getByRole("button", { name: /Filtros/ })).toHaveTextContent(
      "Filtros2",
    );
  });

  it("shows no count when no filter is active", () => {
    renderSheet(0);
    expect(screen.getByRole("button", { name: "Filtros" })).toHaveTextContent(
      /^Filtros$/,
    );
  });
});
