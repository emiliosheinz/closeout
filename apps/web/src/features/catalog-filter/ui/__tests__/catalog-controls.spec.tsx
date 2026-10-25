import { render, screen } from "@testing-library/react";
import { activeFilterChips, parseCatalogParams } from "../../model/params";
import { ActiveFilters } from "../active-filters";
import { CategoryChips } from "../category-chips";
import { FilterForm } from "../filter-form";
import { SearchForm } from "../search-form";

const categories = [
  { slug: "moveis", name: "Móveis", count: 2 },
  { slug: "cozinha", name: "Cozinha", count: 1 },
];

describe("catalog controls", () => {
  // Accessible-name whitespace between label and count depends on CSS (flex-item blockification); jsdom loads no CSS, so allow either.
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
    expect(screen.getByRole("link", { name: /^Cozinha\s*1$/ })).toHaveAttribute(
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
    expect(screen.getByRole("link", { name: /^Móveis\s*2$/ })).toHaveAttribute(
      "href",
      "/store/loja-da-bia?categoria=moveis",
    );
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("submits search and filters of %s to its own catalog", (slug, path) => {
    const filters = parseCatalogParams({});
    const { container } = render(
      <>
        <SearchForm storeSlug={slug} filters={filters} />
        <FilterForm storeSlug={slug} filters={filters} />
      </>,
    );
    const [search, filter] = Array.from(container.querySelectorAll("form"));
    expect(search).toHaveAttribute("action", path);
    expect(filter).toHaveAttribute("action", path);
    expect(screen.getByRole("link", { name: "Limpar tudo" })).toHaveAttribute(
      "href",
      path,
    );
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("removes active filters of %s without leaving it", (slug, path) => {
    const filters = parseCatalogParams({ q: "mesa", categoria: "moveis" });
    render(
      <ActiveFilters
        storeSlug={slug}
        chips={activeFilterChips(slug, filters, () => "Móveis")}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Remover filtro Móveis" }),
    ).toHaveAttribute("href", `${path}?q=mesa`);
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", path);
  });

  it("reflects the search, category and sort of the URL in the controls", () => {
    const filters = parseCatalogParams({
      q: "mesa",
      categoria: "moveis",
      ordem: "menor-preco",
    });
    render(
      <>
        <SearchForm storeSlug="loja" filters={filters} />
        <CategoryChips
          storeSlug="loja"
          categories={categories}
          filters={filters}
        />
        <FilterForm storeSlug="loja" filters={filters} />
      </>,
    );
    expect(screen.getByRole("searchbox", { name: "Buscar itens" })).toHaveValue(
      "mesa",
    );
    expect(screen.getByRole("link", { name: /^Móveis\s*2$/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tudo" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: /^Cozinha\s*1$/ }),
    ).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("radio", { name: "Menor preço" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Mais recentes" }),
    ).not.toBeChecked();
  });
});
