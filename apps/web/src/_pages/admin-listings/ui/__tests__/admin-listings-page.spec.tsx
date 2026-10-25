import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { stubAdminApi } from "@/test/admin-api";
import { renderWithFeedback } from "@/test/feedback-harness";
import { listingSummary, meResponse, seller } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { DashboardPage } from "../admin-listings-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const listings = [
  listingSummary({ id: "l-1", title: "Sofá azul" }),
  listingSummary({
    id: "l-2",
    title: "Mesa de jantar",
    publication: "draft",
  }),
  listingSummary({
    id: "l-3",
    title: "Cadeira",
    availability: "sold",
  }),
];

/** The page under a URL with `search`, which the table reads and writes. */
const atUrl = async (search: string) => (
  <NuqsTestingAdapter searchParams={search} hasMemory>
    {await DashboardPage()}
  </NuqsTestingAdapter>
);

const show = async (search = "") => renderPage(await atUrl(search));

/** Row titles in display order (the first link of each row is its title). */
const titles = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryAllByRole("link")[0]?.textContent);

const tab = (name: RegExp) =>
  within(screen.getByRole("group", { name: "Filtrar por situação" })).getByRole(
    "button",
    { name },
  );

const search = (value: string) =>
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Buscar anúncios pelo título" }),
    { target: { value } },
  );

const header = (name: RegExp) => screen.getByRole("columnheader", { name });
const sortBy = (name: RegExp) =>
  fireEvent.click(within(header(name)).getByRole("button"));

describe("admin listings page", () => {
  it("loads the listings and sellers and shows every listing", async () => {
    const calls = stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [seller("s-ana", "Ana")] },
    });
    await show();
    expect(calls).toEqual(
      expect.arrayContaining([
        "/stores/store-1/listings",
        "/stores/store-1/sellers",
      ]),
    );
    expect(screen.getByText("Sofá azul")).toBeInTheDocument();
    expect(screen.getByText("Mesa de jantar")).toBeInTheDocument();
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
  });

  it("counts every tab from the loaded listings", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show();
    const tabs = within(
      screen.getByRole("group", { name: "Filtrar por situação" }),
    );
    expect(tabs.getByRole("button", { name: /Todos/ })).toHaveTextContent("3");
    expect(tabs.getByRole("button", { name: /Publicados/ })).toHaveTextContent(
      "2",
    );
    expect(tabs.getByRole("button", { name: /Rascunhos/ })).toHaveTextContent(
      "1",
    );
    expect(tabs.getByRole("button", { name: /Vendidos/ })).toHaveTextContent(
      "1",
    );
  });

  it("filters by status and by title from an existing /admin?status&q link", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show("?status=rascunhos&q=mesa");
    expect(titles()).toEqual(["Mesa de jantar"]);
    expect(screen.getByRole("button", { name: /Rascunhos/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("searchbox", { name: "Buscar anúncios pelo título" }),
    ).toHaveValue("mesa");
  });

  it("rejects when a listing is missing a required field", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { title: _title, ...broken } = listings[0] ?? listingSummary();
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: [broken] },
      "/stores/store-1/sellers": { items: [] },
    });
    await expect(DashboardPage()).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it("sends the member to login when the API says the session ended", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": 401,
      "/stores/store-1/sellers": 401,
    });
    await expect(DashboardPage()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/entrar?erro=sessao-expirada"),
    });
  });

  it("shows not-found, not login, when the lists are missing for another reason", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": 404,
      "/stores/store-1/sellers": 404,
    });
    await expect(DashboardPage()).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("keeps a row under the filtered tab after its status change and moves the counts", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show("?status=vendidos");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      {
        key: "Enter",
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );
    expect(screen.getByTestId("count-available")).toHaveTextContent("2");
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Disponível");
  });

  async function changeCadeiraToAvailable(patch: Promise<Response>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => patch),
    );
    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      { key: "Enter" },
    );
    return trigger;
  }

  it("drops the kept row once the filter or the search changes", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show("?status=vendidos");
    await changeCadeiraToAvailable(new Promise<Response>(() => {}));
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );
    expect(screen.getByText("Cadeira")).toBeInTheDocument();

    fireEvent.click(tab(/Disponíveis/));
    expect(screen.getByText("Cadeira")).toBeInTheDocument();
    fireEvent.click(tab(/Vendidos/));
    expect(screen.queryByText("Cadeira")).toBeNull();
    expect(screen.getByText("Nenhum anúncio em Vendidos.")).toBeInTheDocument();
  });

  it("drops the kept row once only the search changes", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show("?status=vendidos");
    await changeCadeiraToAvailable(new Promise<Response>(() => {}));
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );
    expect(screen.getByText("Cadeira")).toBeInTheDocument();

    search("cadeira");

    expect(screen.queryByText("Cadeira")).toBeNull();
    expect(
      screen.getByText('Nenhum anúncio em Vendidos com "cadeira" no título.'),
    ).toBeInTheDocument();
  });

  it("drops the counts of the tabs the deleted listing matched by one and leaves the others", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    // Invalidation after the delete comes from the admin providers' handlers.
    renderWithFeedback(await atUrl(""));
    let deleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method === "DELETE") deleted = true;
        if (init.method === "GET" && String(url).endsWith("/listings")) {
          return Response.json({
            items: deleted
              ? listings.filter((item) => item.id !== "l-1")
              : listings,
          });
        }
        return new Response(null, { status: 204 });
      }),
    );
    const counts = () =>
      Object.fromEntries(
        ["published", "available", "reserved", "sold", "draft", "archived"].map(
          (name) => [name, screen.getByTestId(`count-${name}`).textContent],
        ),
      );
    const before = counts();
    const all = tab(/Todos/);
    expect(all).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("button", { name: "Excluir Sofá azul" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Excluir anúncio" }),
    );

    await waitFor(() => expect(screen.queryByText("Sofá azul")).toBeNull());
    expect(all).toHaveTextContent("2");
    expect(before).toMatchObject({ published: "2", available: "1" });
    expect(counts()).toEqual({ ...before, published: "1", available: "0" });
  });

  it("restores the tab count when the status change is rejected", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": { items: listings },
      "/stores/store-1/sellers": { items: [] },
    });
    await show();
    let reject!: (response: Response) => void;
    await changeCadeiraToAvailable(
      new Promise<Response>((resolve) => {
        reject = resolve;
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("0"),
    );

    reject(
      Response.json({ message: "Servidor indisponível." }, { status: 500 }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("1"),
    );
    expect(screen.getByTestId("count-available")).toHaveTextContent("1");
  });
});

const serve = (items: ReturnType<typeof listingSummary>[]) =>
  stubAdminApi({
    "/me": meResponse(),
    "/stores/store-1/listings": { items },
    "/stores/store-1/sellers": { items: [] },
  });

const item = (
  title: string,
  overrides: Partial<ReturnType<typeof listingSummary>> = {},
) => listingSummary({ id: title, slug: title, title, ...overrides });

describe("sorting", () => {
  it("orders by last update, newest first, when no sort is set", async () => {
    serve([
      item("Meio", { updatedAt: "2026-10-15T12:00:00.000Z" }),
      item("Novo", { updatedAt: "2026-10-20T12:00:00.000Z" }),
      item("Velho", { updatedAt: "2026-10-01T12:00:00.000Z" }),
    ]);
    await show();
    expect(titles()).toEqual(["Novo", "Meio", "Velho"]);
    expect(header(/Atualizado/)).toHaveAttribute("aria-sort", "descending");
    expect(header(/Título/)).toHaveAttribute("aria-sort", "none");
    expect(header(/Preço/)).toHaveAttribute("aria-sort", "none");

    sortBy(/Atualizado/);
    expect(titles()).toEqual(["Velho", "Meio", "Novo"]);
    expect(header(/Atualizado/)).toHaveAttribute("aria-sort", "ascending");
  });

  it("orders titles in Portuguese alphabetical order, toggling on repeat", async () => {
    serve(["Cadeira", "Banco", "Árvore", "abajur"].map((title) => item(title)));
    await show();

    sortBy(/Título/);
    expect(titles()).toEqual(["abajur", "Árvore", "Banco", "Cadeira"]);
    expect(header(/Título/)).toHaveAttribute("aria-sort", "ascending");

    sortBy(/Título/);
    expect(titles()).toEqual(["Cadeira", "Banco", "Árvore", "abajur"]);
    expect(header(/Título/)).toHaveAttribute("aria-sort", "descending");
  });

  it("orders by price with negotiable prices last in both directions", async () => {
    serve([
      item("Caro", { priceCents: 500000 }),
      item("A combinar", { priceCents: null }),
      item("Barato", { priceCents: 1000 }),
      item("De graça", { priceCents: 0 }),
    ]);
    await show();

    sortBy(/Preço/);
    expect(titles()).toEqual(["De graça", "Barato", "Caro", "A combinar"]);
    sortBy(/Preço/);
    expect(titles()).toEqual(["Caro", "Barato", "De graça", "A combinar"]);
    expect(header(/Preço/)).toHaveAttribute("aria-sort", "descending");
  });

  it("reads the sort from the URL", async () => {
    serve(["Banco", "Árvore"].map((title) => item(title)));
    await show("?ordem=titulo-desc");
    expect(titles()).toEqual(["Banco", "Árvore"]);
  });
});

describe("status filters", () => {
  const everyStatus = [
    item("publicado disponível"),
    item("publicado reservado", { availability: "reserved" }),
    item("publicado vendido", { availability: "sold" }),
    item("rascunho disponível", { publication: "draft" }),
    item("rascunho vendido", { publication: "draft", availability: "sold" }),
    item("arquivado reservado", {
      publication: "archived",
      availability: "reserved",
    }),
  ];
  const all = everyStatus.map((listing) => listing.title);

  it.each([
    [
      "publicados",
      ["publicado disponível", "publicado reservado", "publicado vendido"],
    ],
    ["disponiveis", ["publicado disponível"]],
    ["reservados", ["publicado reservado"]],
    ["vendidos", ["publicado vendido"]],
    ["rascunhos", ["rascunho disponível", "rascunho vendido"]],
    ["arquivados", ["arquivado reservado"]],
    ["qualquer-coisa", all],
  ])("?status=%s shows exactly its listings", async (slug, expected) => {
    serve(everyStatus);
    await show(`?status=${slug}`);
    expect(titles()).toEqual(expected);
  });

  it("shows every listing without a status", async () => {
    serve(everyStatus);
    await show();
    expect(titles()).toEqual(all);
  });

  it("keeps the store-wide counts while a search and a filter are active", async () => {
    serve(everyStatus);
    await show("?status=vendidos&q=publicado");
    expect(titles()).toEqual(["publicado vendido"]);
    expect(tab(/Todos/)).toHaveTextContent("6");
    const counts = Object.fromEntries(
      ["published", "available", "reserved", "sold", "draft", "archived"].map(
        (name) => [name, screen.getByTestId(`count-${name}`).textContent],
      ),
    );
    expect(counts).toEqual({
      published: "3",
      available: "1",
      reserved: "1",
      sold: "1",
      draft: "2",
      archived: "1",
    });
  });
});

describe("search", () => {
  it("matches titles ignoring case and accents", async () => {
    serve([item("Café expresso"), item("Chaleira")]);
    await show();
    search("CAFE");
    expect(titles()).toEqual(["Café expresso"]);
  });

  it("ignores spaces around the search and shows every row for blank spaces", async () => {
    serve([item("Mesa de jantar"), item("Cadeira")]);
    await show();

    search("  mesa  ");
    expect(titles()).toEqual(["Mesa de jantar"]);

    search("   ");
    expect(titles()).toEqual(["Mesa de jantar", "Cadeira"]);
  });

  it("says nothing matched the search", async () => {
    serve([item("Sofá")]);
    await show("?q=mesa");
    expect(
      screen.getByText('Nenhum anúncio com "mesa" no título.'),
    ).toBeInTheDocument();
  });

  it("names the active tab when nothing matched under it", async () => {
    serve([item("Mesa")]);
    await show("?status=vendidos&q=mesa");
    expect(
      screen.getByText('Nenhum anúncio em Vendidos com "mesa" no título.'),
    ).toBeInTheDocument();
  });

  it("invites creating the first listing when there are none", async () => {
    serve([]);
    await show();
    expect(
      screen.getByText("Nenhum anúncio ainda. Comece pelo botão Novo anúncio."),
    ).toBeInTheDocument();
  });
});

describe("rows", () => {
  it("flags only the listings whose seller has no WhatsApp number", async () => {
    stubAdminApi({
      "/me": meResponse(),
      "/stores/store-1/listings": {
        items: [
          item("Sem contato", {
            sellers: [{ id: "s-mudo", displayName: "Mudo" }],
          }),
          item("Com contato", {
            sellers: [{ id: "s-ana", displayName: "Ana" }],
          }),
        ],
      },
      "/stores/store-1/sellers": {
        items: [
          { ...seller("s-mudo", "Mudo"), whatsappNumber: null },
          seller("s-ana", "Ana"),
        ],
      },
    });
    await show();

    const flagged = (title: string) =>
      within(
        screen.getByRole("link", { name: title }).closest("tr") as HTMLElement,
      ).queryByRole("link", { name: /Vendedor sem WhatsApp/ });
    expect(flagged("Sem contato")).toBeInTheDocument();
    expect(flagged("Com contato")).toBeNull();
  });

  it("keeps a pending copy with its own listing when two listings share a title and the sort flips", async () => {
    serve([
      listingSummary({
        id: "m-1",
        slug: "mesa-1",
        title: "Mesa",
        priceCents: 1000,
        availability: "available",
      }),
      listingSummary({
        id: "m-2",
        slug: "mesa-2",
        title: "Mesa",
        priceCents: 2000,
        availability: "sold",
      }),
    ]);
    await show("?ordem=preco-asc");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const copies = (options: { hidden?: boolean } = {}) =>
      screen
        .getAllByRole("button", { name: "Duplicar Mesa", ...options })
        .map((button) => (button as HTMLButtonElement).disabled);
    expect(copies()).toEqual([false, false]);

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Duplicar Mesa",
      })[1] as HTMLElement,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Duplicar anúncio" }),
    );
    await waitFor(() =>
      expect(copies({ hidden: true })).toEqual([false, true]),
    );
    // The confirmation stays open while the copy is pending; closing it
    // leaves the request running.
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );

    sortBy(/Preço/);

    expect(copies()).toEqual([true, false]);
  });
});

describe("pages", () => {
  const many = Array.from({ length: 25 }, (_, i) =>
    item(`Item ${String(i).padStart(2, "0")}`),
  );

  it("shows the last page for a page past the end", async () => {
    serve(many);
    await show("?pagina=9");
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(titles()).toHaveLength(5);
  });

  it("goes back to page 1 when the filter, the search or the sort changes", async () => {
    serve(many);
    await show("?pagina=2");
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();

    fireEvent.click(tab(/Publicados/));
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    search("item");
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    sortBy(/Título/);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });
});

describe("a row whose status changed under a filter", () => {
  it("keeps its place through the refetch that follows, and goes once deleted elsewhere", async () => {
    const sold = [
      item("Abajur", {
        availability: "sold",
        updatedAt: "2026-10-16T12:00:00.000Z",
      }),
      item("Cadeira", {
        availability: "sold",
        updatedAt: "2026-10-15T12:00:00.000Z",
      }),
    ];
    serve(sold);
    const { client } = renderWithFeedback(await atUrl("?status=vendidos"));
    // The server bumps the update time, which would put Cadeira first.
    let server = [
      sold[0],
      {
        ...sold[1],
        availability: "available",
        updatedAt: "2026-10-20T12:00:00.000Z",
      },
    ];
    let listFetches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method === "GET" && String(url).endsWith("/listings")) {
          listFetches++;
          return Response.json({ items: server });
        }
        if (init.method === "GET") return Response.json({ items: [] });
        return new Response(null, { status: 204 });
      }),
    );
    expect(titles()).toEqual(["Abajur", "Cadeira"]);

    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      { key: "Enter" },
    );
    await waitFor(() => expect(listFetches).toBe(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(titles()).toEqual(["Abajur", "Cadeira"]);
    expect(
      within(screen.getAllByRole("row")[2] as HTMLElement).getByText(
        "20/10/2026",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Disponibilidade de Cadeira" }),
    ).toHaveTextContent("Disponível");
    expect(screen.getByTestId("count-sold")).toHaveTextContent("1");

    server = [sold[0]];
    await act(() => client.refetchQueries({ queryKey: ["listings"] }));
    await waitFor(() => expect(titles()).toEqual(["Abajur"]));
  });
});

describe("a row changed twice under a filter", () => {
  it("keeps its original place after the second change", async () => {
    const sold = [
      item("Abajur", {
        availability: "sold",
        updatedAt: "2026-10-16T12:00:00.000Z",
      }),
      item("Cadeira", {
        availability: "sold",
        updatedAt: "2026-10-15T12:00:00.000Z",
      }),
    ];
    serve(sold);
    renderWithFeedback(await atUrl("?status=vendidos"));
    const server = [
      sold[0],
      {
        ...sold[1],
        availability: "available",
        updatedAt: "2026-10-20T12:00:00.000Z",
      },
    ];
    let listFetches = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method === "GET" && String(url).endsWith("/listings")) {
          listFetches++;
          return Response.json({ items: server });
        }
        if (init.method === "GET") return Response.json({ items: [] });
        return new Response(null, { status: 204 });
      }),
    );
    const change = async (option: string) => {
      const trigger = screen.getByRole("combobox", {
        name: "Disponibilidade de Cadeira",
      });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
      fireEvent.keyDown(await screen.findByRole("option", { name: option }), {
        key: "Enter",
      });
    };
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

    await change("Disponível");
    await waitFor(() => expect(listFetches).toBe(1));
    await settle();
    expect(titles()).toEqual(["Abajur", "Cadeira"]);

    await change("Reservado");
    await waitFor(() => expect(listFetches).toBe(2));
    await settle();

    expect(titles()).toEqual(["Abajur", "Cadeira"]);
  });
});

describe("pinned rows and the view", () => {
  const sold = [
    item("Abajur", { availability: "sold" }),
    item("Cadeira", { availability: "sold" }),
  ];

  async function pinCadeira() {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const trigger = screen.getByRole("combobox", {
      name: "Disponibilidade de Cadeira",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      { key: "Enter" },
    );
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("1"),
    );
    expect(titles()).toEqual(["Abajur", "Cadeira"]);
  }

  it("drops a pinned row once the sort changes", async () => {
    serve(sold);
    await show("?status=vendidos");
    await pinCadeira();

    sortBy(/Título/);

    expect(titles()).toEqual(["Abajur"]);
  });

  it("drops a pinned row once the URL changes from elsewhere", async () => {
    serve(sold);
    const client = new QueryClient();
    const page = await DashboardPage();
    const at = (search: string) => (
      <QueryClientProvider client={client}>
        <NuqsTestingAdapter searchParams={search} hasMemory>
          {page}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    );
    const view = render(at("?status=vendidos&ordem=titulo-asc"));
    await pinCadeira();

    view.rerender(at("?status=vendidos"));

    await waitFor(() => expect(titles()).toEqual(["Abajur"]));
  });

  it("drops a pinned row once the page changes", async () => {
    const soldMany = Array.from({ length: 22 }, (_, i) =>
      item(`Vendido ${String(i).padStart(2, "0")}`, { availability: "sold" }),
    );
    serve(soldMany);
    await show("?status=vendidos&ordem=titulo-asc");
    const first = screen.getByRole("combobox", {
      name: "Disponibilidade de Vendido 00",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.keyDown(
      await screen.findByRole("option", { name: "Disponível" }),
      { key: "Enter" },
    );
    await waitFor(() =>
      expect(screen.getByTestId("count-sold")).toHaveTextContent("21"),
    );
    expect(titles()).toContain("Vendido 00");

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));

    expect(titles()).not.toContain("Vendido 00");
  });
});

describe("a seller's view", () => {
  it("shows the search, the sort headers and the count of the rows loaded", async () => {
    stubAdminApi({
      "/me": meResponse("seller"),
      "/stores/store-1/listings": {
        items: [item("Cadeira"), item("Banco"), item("Abajur")],
      },
      "/stores/store-1/sellers": { items: [] },
    });
    await show();

    expect(
      screen.getByRole("searchbox", { name: "Buscar anúncios pelo título" }),
    ).toBeInTheDocument();
    for (const name of [/Título/, /Preço/, /Atualizado/]) {
      expect(within(header(name)).getByRole("button")).toBeInTheDocument();
    }
    expect(tab(/Todos/)).toHaveTextContent("3");

    sortBy(/Título/);

    expect(titles()).toEqual(["Abajur", "Banco", "Cadeira"]);
  });
});
