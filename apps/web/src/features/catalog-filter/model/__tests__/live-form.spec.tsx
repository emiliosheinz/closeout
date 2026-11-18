import { act, fireEvent, render, screen } from "@testing-library/react";
import type { CatalogFilters } from "@/entities/listing";
import { FilterForm } from "../../ui/filter-form";
import { SearchForm } from "../../ui/search-form";
import { parseCatalogParams } from "../params";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function Controls({ filters }: { filters: CatalogFilters }) {
  return (
    <>
      <SearchForm storeSlug="loja" filters={filters} />
      <FilterForm storeSlug="loja" filters={filters} live />
    </>
  );
}

const searchbox = () => screen.getByRole("searchbox", { name: "Buscar itens" });
const minPrice = () => screen.getByLabelText("Preço mínimo em reais");
const maxPrice = () => screen.getByLabelText("Preço máximo em reais");
const pushedUrls = () => push.mock.calls.map(([url]) => url);

beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("live search", () => {
  it("searches once typing pauses, without Enter", () => {
    render(<Controls filters={parseCatalogParams({ category: "moveis" })} />);

    fireEvent.change(searchbox(), { target: { value: "s" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(searchbox(), { target: { value: "sof" } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(searchbox(), { target: { value: "sofá" } });
    act(() => vi.advanceTimersByTime(399));
    expect(push).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(pushedUrls()).toEqual(["/store/loja?q=sof%C3%A1&category=moveis"]);
    expect(push).toHaveBeenCalledWith(expect.any(String), { scroll: false });
  });

  it("searches at once on Enter", () => {
    render(<Controls filters={parseCatalogParams({})} />);

    fireEvent.change(searchbox(), { target: { value: "mesa" } });
    fireEvent.submit(searchbox());

    expect(pushedUrls()).toEqual(["/store/loja?q=mesa"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("returns to the first page and keeps the other filters", () => {
    render(
      <Controls
        filters={parseCatalogParams({
          condition: "good",
          min: "10",
          sort: "price_asc",
          page: "3",
        })}
      />,
    );

    fireEvent.change(searchbox(), { target: { value: "cadeira" } });
    act(() => vi.advanceTimersByTime(400));

    expect(pushedUrls()).toEqual([
      "/store/loja?q=cadeira&condition=good&min=10&sort=price_asc",
    ]);
  });

  it("does not navigate when the search ends where it started", () => {
    render(<Controls filters={parseCatalogParams({ q: "abajur" })} />);

    fireEvent.change(searchbox(), { target: { value: "abajur " } });
    act(() => vi.advanceTimersByTime(400));

    expect(push).not.toHaveBeenCalled();
  });

  it("drops a pending search when the catalog goes away", () => {
    const { unmount } = render(<Controls filters={parseCatalogParams({})} />);

    fireEvent.change(searchbox(), { target: { value: "vaso" } });
    unmount();
    act(() => vi.advanceTimersByTime(400));

    expect(push).not.toHaveBeenCalled();
  });
});

describe("live sidebar filters", () => {
  it("applies a condition or a sort as soon as it is picked", () => {
    render(<Controls filters={parseCatalogParams({ q: "mesa", page: "2" })} />);

    fireEvent.click(screen.getByRole("radio", { name: "Como novo" }));
    expect(pushedUrls()).toEqual(["/store/loja?q=mesa&condition=like_new"]);

    fireEvent.click(screen.getByRole("radio", { name: "Maior preço" }));
    expect(pushedUrls()[1]).toBe(
      "/store/loja?q=mesa&condition=like_new&sort=price_desc",
    );
  });

  it("applies typed prices once typing pauses", () => {
    render(<Controls filters={parseCatalogParams({})} />);

    fireEvent.change(minPrice(), { target: { value: "1" } });
    fireEvent.change(minPrice(), { target: { value: "15" } });
    act(() => vi.advanceTimersByTime(399));
    expect(push).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(pushedUrls()).toEqual(["/store/loja?min=15"]);
  });

  it("orders swapped prices and ignores an invalid one instead of failing", () => {
    render(<Controls filters={parseCatalogParams({})} />);

    fireEvent.change(minPrice(), { target: { value: "500" } });
    fireEvent.change(maxPrice(), { target: { value: "20" } });
    act(() => vi.advanceTimersByTime(400));
    expect(pushedUrls()).toEqual(["/store/loja?min=20&max=500"]);

    fireEvent.change(maxPrice(), { target: { value: "-3" } });
    act(() => vi.advanceTimersByTime(400));
    expect(pushedUrls()[1]).toBe("/store/loja?min=500");
  });

  it("has no apply button, only a way to clear everything", () => {
    render(<Controls filters={parseCatalogParams({ condition: "good" })} />);

    expect(screen.queryByText("Disponibilidade")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aplicar filtros" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar tudo" })).toHaveAttribute(
      "href",
      "/store/loja",
    );
  });

  it("keeps a search applied a moment before a filter is picked", () => {
    render(<Controls filters={parseCatalogParams({ category: "sala" })} />);

    fireEvent.change(searchbox(), { target: { value: "tapete" } });
    act(() => vi.advanceTimersByTime(400));
    // The page has not re-rendered with the search yet.
    fireEvent.click(screen.getByRole("radio", { name: "Menor preço" }));

    expect(pushedUrls()).toEqual([
      "/store/loja?q=tapete&category=sala",
      "/store/loja?q=tapete&category=sala&sort=price_asc",
    ]);
  });

  it("keeps a filter picked while a search was still being typed", () => {
    render(<Controls filters={parseCatalogParams({})} />);

    fireEvent.change(searchbox(), { target: { value: "panela" } });
    fireEvent.click(screen.getByRole("radio", { name: "Bom estado" }));
    act(() => vi.advanceTimersByTime(400));

    expect(pushedUrls().at(-1)).toBe("/store/loja?q=panela&condition=good");
  });
});

describe("controls after the URL changes", () => {
  it("show a URL that came from elsewhere, such as a removed chip", () => {
    const { rerender } = render(
      <Controls
        filters={parseCatalogParams({
          q: "mesa",
          condition: "good",
          max: "300",
        })}
      />,
    );

    rerender(<Controls filters={parseCatalogParams({ condition: "new" })} />);

    expect(searchbox()).toHaveValue("");
    expect(maxPrice()).toHaveValue(null);
    expect(screen.getByRole("radio", { name: "Novo" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Bom estado" })).not.toBeChecked();
  });

  it("leave the text being typed alone, including what was typed meanwhile", () => {
    const { rerender } = render(<Controls filters={parseCatalogParams({})} />);
    searchbox().focus();
    fireEvent.change(searchbox(), { target: { value: "cama" } });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.change(searchbox(), { target: { value: "cama box" } });

    rerender(<Controls filters={parseCatalogParams({ q: "cama" })} />);

    expect(searchbox()).toHaveFocus();
    expect(searchbox()).toHaveValue("cama box");
    act(() => vi.advanceTimersByTime(400));
    expect(pushedUrls().at(-1)).toBe("/store/loja?q=cama+box");
  });

  it("leave prices alone when the visitor's own swapped range lands", () => {
    const { rerender } = render(
      <Controls filters={parseCatalogParams({ min: "500" })} />,
    );
    maxPrice().focus();
    fireEvent.change(maxPrice(), { target: { value: "1" } });
    act(() => vi.advanceTimersByTime(400));
    expect(pushedUrls()).toEqual(["/store/loja?min=1&max=500"]);

    rerender(
      <Controls filters={parseCatalogParams({ min: "1", max: "500" })} />,
    );

    expect(minPrice()).toHaveValue(500);
    expect(maxPrice()).toHaveValue(1);
  });
});

describe("filters in the mobile sheet", () => {
  it("wait for the apply button, which stays at the bottom of the sheet", () => {
    render(<FilterForm storeSlug="loja" filters={parseCatalogParams({})} />);

    fireEvent.click(screen.getByRole("radio", { name: "Como novo" }));
    fireEvent.change(minPrice(), { target: { value: "50" } });
    act(() => vi.advanceTimersByTime(1000));
    expect(push).not.toHaveBeenCalled();

    const apply = screen.getByRole("button", { name: "Aplicar filtros" });
    expect(apply).toHaveAttribute("type", "submit");
    const actions = apply.parentElement;
    expect(actions).toHaveClass("sticky", "bottom-0");
    expect(actions).toContainElement(
      screen.getByRole("link", { name: "Limpar tudo" }),
    );
  });
});
