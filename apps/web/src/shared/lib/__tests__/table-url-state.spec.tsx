import { act, renderHook } from "@testing-library/react";
import { parseAsString } from "nuqs";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import {
  createTableUrlState,
  lastPage,
  useTableUrlState,
} from "../table-url-state";

const members = createTableUrlState({
  prefix: "membros-",
  sorts: ["nome", "papel"],
  defaultSort: null,
});
const listings = createTableUrlState({
  prefix: "",
  sorts: ["titulo", "preco", "atualizado"],
  defaultSort: { column: "atualizado", direction: "desc" },
});

function setup(search: string) {
  const onUrlUpdate = vi.fn();
  const hook = renderHook(() => useTableUrlState(members), {
    wrapper: withNuqsTestingAdapter({
      searchParams: search,
      onUrlUpdate,
      hasMemory: true,
    }),
  });
  const lastUrl = () => onUrlUpdate.mock.lastCall?.[0].queryString;
  return { ...hook, lastUrl };
}

describe("reading the URL", () => {
  it("has no sort, page 1 and an empty query by default", () => {
    const { result } = setup("");
    expect(result.current[0]).toEqual({ query: "", sort: null, page: 1 });
  });

  it("reads the prefixed keys", () => {
    const { result } = setup(
      "?membros-q=ana&membros-ordem=papel-desc&membros-pagina=2",
    );
    expect(result.current[0]).toEqual({
      query: "ana",
      sort: { column: "papel", direction: "desc" },
      page: 2,
    });
  });

  it("falls back to the default sort for unknown or malformed sorts", () => {
    for (const ordem of [
      "preco-asc",
      "nome-up",
      "nome",
      "-asc",
      "nome-asc-x",
    ]) {
      expect(
        setup(`?membros-ordem=${ordem}`).result.current[0].sort,
      ).toBeNull();
    }
    const { result } = renderHook(() => useTableUrlState(listings), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?ordem=nome-asc" }),
    });
    expect(result.current[0].sort).toEqual({
      column: "atualizado",
      direction: "desc",
    });
  });

  it("turns non-numeric and sub-1 pages into page 1", () => {
    for (const pagina of ["abc", "0", "-3", "1.5"]) {
      expect(setup(`?membros-pagina=${pagina}`).result.current[0].page).toBe(1);
    }
  });

  it("reads pages past the last page as written, without rewriting the URL", () => {
    const { result, lastUrl } = setup("?membros-pagina=9");
    expect(result.current[0].page).toBe(9);
    expect(lastUrl()).toBeUndefined();
  });

  it("ignores the keys of other tables", () => {
    const { result } = setup("?convites-q=x&convites-pagina=2&q=y");
    expect(result.current[0]).toEqual({ query: "", sort: null, page: 1 });
  });
});

describe("lastPage", () => {
  it("allows a full last page and nothing past it", () => {
    expect(lastPage(61)).toBe(4);
    expect(lastPage(60)).toBe(3);
    expect(lastPage(0)).toBe(1);
  });
});

describe("writing the URL", () => {
  it("writes non-default values under the table's own keys and clears defaults", async () => {
    const { result, lastUrl } = setup("?convites-q=x&q=listings");

    await act(() =>
      result.current[1]({
        sort: { column: "papel", direction: "desc" },
        query: "ana",
      }),
    );
    expect(lastUrl()).toBe(
      "?convites-q=x&q=listings&membros-ordem=papel-desc&membros-q=ana",
    );

    await act(() => result.current[1]({ sort: null, query: "" }));
    expect(lastUrl()).toBe("?convites-q=x&q=listings");
  });

  it("resets the page when sort or query change", async () => {
    const { result, lastUrl } = setup("?membros-pagina=2");
    await act(() =>
      result.current[1]({ sort: { column: "nome", direction: "asc" } }),
    );
    expect(lastUrl()).toBe("?membros-ordem=nome-asc");

    await act(() => result.current[1]({ page: 2 }));
    await act(() => result.current[1]({ query: "ana" }));
    expect(lastUrl()).toBe("?membros-ordem=nome-asc&membros-q=ana");
  });

  it("keeps an explicitly set page", async () => {
    const { result, lastUrl } = setup("");
    await act(() => result.current[1]({ page: 2 }));
    expect(lastUrl()).toBe("?membros-pagina=2");
  });
});

describe("extra filters", () => {
  it("shares the state and resets the page when they change", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(
      () =>
        useTableUrlState(listings, {
          status: parseAsString.withDefault(""),
        }),
      {
        wrapper: withNuqsTestingAdapter({
          searchParams: "?status=publicados&pagina=3",
          onUrlUpdate,
          hasMemory: true,
        }),
      },
    );
    expect(result.current[0].status).toBe("publicados");
    expect(result.current[0].page).toBe(3);

    await act(() => result.current[1]({ status: "rascunhos" }));
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe(
      "?status=rascunhos",
    );
  });
});
