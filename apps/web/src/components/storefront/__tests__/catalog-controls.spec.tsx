import { render, screen } from "@testing-library/react";
import { activeFilterChips, parseCatalogParams } from "@/lib/catalog/params";
import { ActiveFilters } from "../active-filters";
import { CategoryChips } from "../category-chips";
import { FilterForm } from "../filter-form";
import { SearchForm } from "../search-form";

const categories = [
  { slug: "moveis", name: "Móveis", count: 2 },
  { slug: "cozinha", name: "Cozinha", count: 1 },
];

describe("catalog controls", () => {
  it("links category chips within the store, keeping the search", () => {
    render(
      <CategoryChips
        storeSlug="nosso-desapego"
        categories={categories}
        filters={parseCatalogParams({ q: "mesa", categoria: "moveis" })}
      />,
    );
    expect(screen.getByRole("link", { name: "Tudo" })).toHaveAttribute(
      "href",
      "/store/nosso-desapego?q=mesa",
    );
    expect(screen.getByRole("link", { name: "Cozinha 1" })).toHaveAttribute(
      "href",
      "/store/nosso-desapego?q=mesa&categoria=cozinha",
    );
  });

  it("links category chips of another store to that store", () => {
    render(
      <CategoryChips
        storeSlug="loja-da-bia"
        categories={categories}
        filters={parseCatalogParams({})}
      />,
    );
    expect(screen.getByRole("link", { name: "Tudo" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia",
    );
    expect(screen.getByRole("link", { name: "Móveis 2" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia?categoria=moveis",
    );
  });

  it("submits search and filters to the store's catalog", () => {
    const filters = parseCatalogParams({});
    render(<SearchForm storeSlug="nosso-desapego" filters={filters} />);
    render(<FilterForm storeSlug="loja-da-bia" filters={filters} />);
    const [search, filter] = Array.from(document.querySelectorAll("form"));
    expect(search).toHaveAttribute("action", "/store/nosso-desapego");
    expect(filter).toHaveAttribute("action", "/store/loja-da-bia");
    expect(screen.getByRole("link", { name: "Limpar tudo" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia",
    );
  });

  it("removes active filters without leaving the store", () => {
    const filters = parseCatalogParams({ q: "mesa", categoria: "moveis" });
    render(
      <ActiveFilters
        storeSlug="loja-da-bia"
        chips={activeFilterChips("loja-da-bia", filters, () => "Móveis")}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Remover filtro Móveis" }),
    ).toHaveAttribute("href", "/store/loja-da-bia?q=mesa");
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/store/loja-da-bia");
  });
});
