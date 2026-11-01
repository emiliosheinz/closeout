import {
  QueryClient as Client,
  dehydrate,
  type QueryClient,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { listingKeys, tabCounts } from "@/entities/listing";
import { renderWithFeedback } from "@/test/feedback-harness";
import { listingSummary, problemResponse } from "@/test/fixtures";
import { useListings } from "../../model/use-listings";
import {
  ListingBuyerLine,
  ListingRowActions,
  ListingStatusSummary,
} from "../listing-rows";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

type Row = ReturnType<typeof listingSummary>;
type Handler = (method: string, path: string) => Response | Promise<Response>;

let serverRows: Row[];
let handler: Handler;
let listResponse: (() => Response | Promise<Response>) | undefined;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockReset();
  listResponse = undefined;
  handler = () => new Response(null, { status: 204 });
  fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const path = String(url).replace("/api/v1", "");
    if (init.method === "GET" && path === "/stores/store/listings") {
      return listResponse?.() ?? Response.json({ items: serverRows });
    }
    if (init.method === "GET" && path === "/stores/store/buyers") {
      return Response.json({ items: [] });
    }
    return handler(init.method ?? "GET", path);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const row = (id: string, overrides: Partial<Row> = {}): Row =>
  listingSummary({
    id,
    slug: id,
    title: `Item ${id}`,
    sellers: [],
    ...overrides,
  });

const ana = (overrides: Partial<NonNullable<Row["sale"]>> = {}) => ({
  buyer: { id: "b-ana", name: "Ana" },
  agreedPriceCents: 10000,
  paid: false,
  notes: null,
  ...overrides,
});

function Host({ storeSlug = "loja" }: { storeSlug?: string }) {
  const listings = useListings("store");
  return (
    <>
      <h1 id="listings-heading" tabIndex={-1}>
        Anúncios
      </h1>
      <output data-testid="reserved">{tabCounts(listings).reserved}</output>
      <table>
        <tbody>
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td>
                {listing.title}
                <ListingBuyerLine listing={listing} />
              </td>
              <td data-testid={`situation-${listing.title}`}>
                <ListingStatusSummary listing={listing} />
              </td>
              <td>
                <ListingRowActions
                  storeId="store"
                  storeSlug={storeSlug}
                  listing={listing}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function renderRows(rows: Row[], props: Parameters<typeof Host>[0] = {}) {
  serverRows = rows;
  const seed: QueryClient = new Client();
  seed.setQueryData(listingKeys.list("store"), { items: rows });
  return renderWithFeedback(<Host {...props} />, dehydrate(seed));
}

const writes = (method: string) =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === method)
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      body: (init as RequestInit).body,
    }))
    .filter(({ url }) => !url.startsWith("/api/catalog"));
const listFetches = () =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url) === "/api/v1/stores/store/listings" &&
      (init as RequestInit | undefined)?.method === "GET",
  ).length;

// The query cache notifies React on a timer, not a microtask.
const settleRender = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const situation = (title: string) => screen.getByTestId(`situation-${title}`);

const trigger = (title: string) =>
  screen.getByRole("button", {
    name: `Ações para ${title}`,
    // An open dialog hides the table from the accessibility tree.
    hidden: true,
  });

async function openMenu(title: string) {
  const button = trigger(title);
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  return screen.findByRole("menu");
}

type MenuRole = "menuitem" | "menuitemradio";

async function choose(title: string, role: MenuRole, name: string) {
  const menu = await openMenu(title);
  fireEvent.click(within(menu).getByRole(role, { name }));
}

/**
 * Picks Reservado or Vendido and submits the buyer dialog. The dialog stays
 * open until the answer arrives, so callers resolve the request to close it.
 */
async function sell(title: string, option: "Reservado" | "Vendido") {
  const sent = writes("PATCH").length;
  await choose(title, "menuitemradio", option);
  // A change still running keeps its dialog open, so the new one is the last.
  const dialog = (await screen.findAllByRole("dialog")).at(-1) as HTMLElement;
  fireEvent.change(
    within(dialog).getByRole("combobox", { name: "Nome do comprador" }),
    { target: { value: "Zeca" } },
  );
  fireEvent.click(within(dialog).getByRole("button", { name: /^Marcar como/ }));
  await waitFor(() => expect(writes("PATCH").length).toBeGreaterThan(sent));
}

describe("listing row cells", () => {
  it.each([
    ["an available published item", {}, "Disponível"],
    ["a draft", { publication: "draft" }, "DisponívelRascunho"],
    ["an archived item", { publication: "archived" }, "DisponívelArquivado"],
    [
      "an unpaid reservation",
      { availability: "reserved", sale: ana() },
      "ReservadoNão pago",
    ],
    [
      "a paid sale",
      { availability: "sold", sale: ana({ paid: true }) },
      "VendidoPago",
    ],
    ["a sale with no buyer", { availability: "sold" }, "Vendido"],
  ] as const)("summarizes the status of %s", (_name, overrides, text) => {
    renderRows([row("a", overrides)]);
    expect(situation("Item a").textContent).toBe(text);
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego/items/a"],
    ["loja-da-bia", "/store/loja-da-bia/items/a"],
  ])("links published items to their page in %s", async (slug, href) => {
    renderRows([row("a")], { storeSlug: slug });
    const menu = await openMenu("Item a");
    expect(
      within(menu).getByRole("menuitem", { name: "Ver na loja" }),
    ).toHaveAttribute("href", href);
  });

  it("links unpublished items to the admin preview", async () => {
    renderRows([row("b", { publication: "draft" })]);
    const menu = await openMenu("Item b");
    expect(
      within(menu).getByRole("menuitem", { name: "Pré-visualizar" }),
    ).toHaveAttribute("href", "/admin/listings/b/preview");
  });

  it("lists the actions of an available item and links to its editor", async () => {
    renderRows([row("a")]);
    const menu = await openMenu("Item a");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Editar anúncio", "Ver na loja", "Duplicar", "Excluir"]);
    expect(
      within(menu).getByRole("menuitem", { name: "Editar anúncio" }),
    ).toHaveAttribute("href", "/admin/listings/a");
  });

  it("checks the current availability and publication in the menu", async () => {
    renderRows([row("a", { availability: "reserved", publication: "draft" })]);
    const menu = await openMenu("Item a");
    const checked = (group: string) =>
      within(within(menu).getByRole("group", { name: group }))
        .getAllByRole("menuitemradio")
        .map((item) => [item.textContent, item.getAttribute("aria-checked")]);
    expect(checked("Disponibilidade")).toEqual([
      ["Disponível", "false"],
      ["Reservado", "true"],
      ["Vendido", "false"],
    ]);
    expect(checked("Publicação")).toEqual([
      ["Rascunho", "true"],
      ["Publicado", "false"],
      ["Arquivado", "false"],
    ]);
  });

  it("lists the sale actions of a sold item between the statuses and the rest", async () => {
    renderRows([row("a", { availability: "sold", sale: ana() })]);
    const menu = await openMenu("Item a");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Marcar como pago",
      "Dados da venda",
      "Editar anúncio",
      "Ver na loja",
      "Duplicar",
      "Excluir",
    ]);
  });

  describe("with a fine pointer and room", () => {
    beforeEach(() => {
      const { matchMedia } = window;
      vi.stubGlobal("matchMedia", (query: string) => ({
        ...matchMedia(query),
        matches: true,
      }));
    });

    it("keeps each status in a submenu that shows its current value", async () => {
      renderRows([
        row("a", { availability: "reserved", publication: "draft" }),
      ]);
      const menu = await openMenu("Item a");
      expect(within(menu).queryByRole("group")).toBeNull();
      const subTriggers = within(menu)
        .getAllByRole("menuitem")
        .filter((item) => item.getAttribute("aria-haspopup") === "menu");
      expect(subTriggers.map((item) => item.textContent)).toEqual([
        "DisponibilidadeReservado",
        "PublicaçãoRascunho",
      ]);
    });

    it("chooses the availability from its submenu", async () => {
      renderRows([row("a")]);
      const menu = await openMenu("Item a");
      const sub = within(menu).getByRole("menuitem", {
        name: /^Disponibilidade/,
      });
      sub.focus();
      fireEvent.keyDown(sub, { key: "ArrowRight" });
      const choices = await screen.findByRole("group", {
        name: "Disponibilidade",
      });
      fireEvent.click(
        within(choices).getByRole("menuitemradio", { name: "Reservado" }),
      );

      expect(
        await screen.findByRole("dialog", { name: 'Reservar "Item a"' }),
      ).toBeInTheDocument();
      expect(writes("PATCH")).toEqual([]);
    });
  });

  it("asks for the buyer before reserving and sends nothing yet", async () => {
    renderRows([row("a")]);
    await choose("Item a", "menuitemradio", "Reservado");

    expect(
      await screen.findByRole("dialog", { name: 'Reservar "Item a"' }),
    ).toBeInTheDocument();
    expect(writes("PATCH")).toEqual([]);
  });

  it("sends only the publication when it changes", async () => {
    renderRows([row("a")]);
    await choose("Item a", "menuitemradio", "Arquivado");

    await waitFor(() =>
      expect(writes("PATCH")).toEqual([
        {
          url: "/stores/store/listings/a/status",
          body: JSON.stringify({ publication: "archived" }),
        },
      ]),
    );
  });

  it("sends nothing when the current choice is picked again", async () => {
    renderRows([row("a")]);
    await choose("Item a", "menuitemradio", "Publicado");
    await choose("Item a", "menuitemradio", "Disponível");
    await settleRender();

    expect(writes("PATCH")).toEqual([]);
  });

  describe("status changes", () => {
    it("show the new value and the counts before the response, then toast once", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a"), row("b")]);

      await sell("Item a", "Reservado");

      expect(situation("Item a")).toHaveTextContent("Reservado");
      expect(situation("Item b")).toHaveTextContent("Disponível");
      expect(screen.getByTestId("reserved")).toHaveTextContent("1");

      gate.resolve(new Response(null, { status: 204 }));
      expect(
        await screen.findByText('"Item a" reservado para Zeca.'),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/reservado para/)).toHaveLength(1);
    });

    it("say the publication in lowercase in the toast", async () => {
      renderRows([row("a")]);
      await choose("Item a", "menuitemradio", "Rascunho");
      expect(
        await screen.findByText('"Item a" agora está rascunho.'),
      ).toBeInTheDocument();
    });

    it("restore only the row that was rejected and keep the later change", async () => {
      const first = deferred();
      const second = deferred();
      handler = (method, path) => {
        if (method !== "PATCH") return new Response(null, { status: 204 });
        return path.includes("/a/") ? first.promise : second.promise;
      };
      renderRows([row("a"), row("b")]);

      await sell("Item a", "Reservado");
      await sell("Item b", "Vendido");
      first.resolve(problemResponse(500, "Servidor indisponível."));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      await waitFor(() =>
        expect(situation("Item a")).toHaveTextContent("Disponível"),
      );
      expect(situation("Item b")).toHaveTextContent("Vendido");
      expect(screen.getByTestId("reserved")).toHaveTextContent("0");
      second.resolve(new Response(null, { status: 204 }));
      await waitFor(() =>
        expect(screen.getByText('"Item b" vendido para Zeca.')).toBeVisible(),
      );
    });

    it("survive a refetch that lands while they are pending", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      const { client } = renderRows([row("a")]);

      await sell("Item a", "Reservado");
      await client.refetchQueries({ queryKey: listingKeys.list("store") });

      expect(situation("Item a")).toHaveTextContent("Reservado");
      gate.resolve(new Response(null, { status: 204 }));
    });

    it("discard a list response that was already in flight when a change starts", async () => {
      const refetch = deferred();
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      const { client } = renderRows([row("a"), row("b")]);
      listResponse = () => refetch.promise;
      const inFlight = client.refetchQueries({
        queryKey: listingKeys.list("store"),
      });
      await waitFor(() => expect(listFetches()).toBe(1));

      await sell("Item a", "Reservado");
      refetch.resolve(
        Response.json({
          items: [row("a"), row("b", { title: "Item b renomeado" })],
        }),
      );
      await inFlight;
      await settleRender();

      expect(screen.getByText("Item b")).toBeInTheDocument();
      expect(screen.queryByText("Item b renomeado")).toBeNull();
      gate.resolve(new Response(null, { status: 204 }));
    });

    it("discard a list response that lands after a change succeeded while another is pending", async () => {
      const refetch = deferred();
      const first = deferred();
      const second = deferred();
      handler = (method, path) => {
        if (method !== "PATCH") return new Response(null, { status: 204 });
        return path.includes("/a/") ? first.promise : second.promise;
      };
      const { client } = renderRows([row("a"), row("b")]);

      await sell("Item a", "Reservado");
      await sell("Item b", "Vendido");
      listResponse = () => refetch.promise;
      const inFlight = client.refetchQueries({
        queryKey: listingKeys.list("store"),
      });
      await waitFor(() => expect(listFetches()).toBe(1));
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" reservado para Zeca.');
      refetch.resolve(Response.json({ items: [row("a"), row("b")] }));
      await inFlight;
      await settleRender();

      expect(situation("Item a")).toHaveTextContent("Reservado");
      second.resolve(new Response(null, { status: 204 }));
    });

    it("refetch the list once, after the last change settles", async () => {
      const first = deferred();
      const second = deferred();
      handler = (method, path) => {
        if (method !== "PATCH") return new Response(null, { status: 204 });
        return path.includes("/a/") ? first.promise : second.promise;
      };
      renderRows([row("a"), row("b")]);

      await sell("Item a", "Reservado");
      await sell("Item b", "Vendido");
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" reservado para Zeca.');
      expect(listFetches()).toBe(0);

      second.resolve(new Response(null, { status: 204 }));
      await waitFor(() => expect(listFetches()).toBe(1));
      await screen.findByText('"Item b" vendido para Zeca.');
      expect(listFetches()).toBe(1);
    });

    it("keep a settled change in the cache while another is still pending", async () => {
      const first = deferred();
      const second = deferred();
      handler = (method, path) => {
        if (method !== "PATCH") return new Response(null, { status: 204 });
        return path.includes("/a/") ? first.promise : second.promise;
      };
      const { client } = renderRows([row("a"), row("b")]);

      await sell("Item a", "Reservado");
      await sell("Item b", "Vendido");
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" reservado para Zeca.');

      expect(situation("Item a")).toHaveTextContent("Reservado");
      const cached = client.getQueryData<{ items: Row[] }>(
        listingKeys.list("store"),
      );
      expect(cached?.items.find((item) => item.id === "a")?.availability).toBe(
        "reserved",
      );
      expect(cached?.items.find((item) => item.id === "b")?.availability).toBe(
        "available",
      );
      second.resolve(new Response(null, { status: 204 }));
    });

    it("refetch after the last status change even while another kind of mutation is pending", async () => {
      const copying = deferred();
      handler = (method, path) =>
        method === "POST" && path.endsWith("/duplicate")
          ? copying.promise
          : new Response(null, { status: 204 });
      renderRows([row("a"), row("b")]);

      await choose("Item b", "menuitem", "Duplicar");
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );
      await waitFor(() => expect(writes("POST")).toHaveLength(1));
      await choose("Item a", "menuitemradio", "Arquivado");

      await screen.findByText('"Item a" agora está arquivado.');
      await waitFor(() => expect(listFetches()).toBe(1));
      copying.resolve(Response.json({ message: "Erro." }, { status: 500 }));
    });

    it("disable the row's choices and ignore another change while one is pending", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a", { availability: "sold", sale: ana() }), row("b")]);

      await choose("Item a", "menuitemradio", "Arquivado");
      await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
      const menu = await openMenu("Item a");

      for (const name of ["Disponível", "Reservado", "Rascunho", "Publicado"]) {
        expect(
          within(menu).getByRole("menuitemradio", { name }),
        ).toHaveAttribute("aria-disabled", "true");
      }
      expect(
        within(menu).getByRole("menuitem", { name: "Marcar como pago" }),
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        within(menu).getByRole("menuitem", { name: "Dados da venda" }),
      ).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(
        within(menu).getByRole("menuitemradio", { name: "Rascunho" }),
      );
      expect(writes("PATCH")).toHaveLength(1);
      expect(situation("Item a")).toHaveTextContent("Arquivado");

      fireEvent.keyDown(menu, { key: "Escape" });
      const other = await openMenu("Item b");
      expect(
        within(other).getByRole("menuitemradio", { name: "Rascunho" }),
      ).not.toHaveAttribute("aria-disabled");
      gate.resolve(new Response(null, { status: 204 }));
    });

    it.each([
      ["succeeds", new Response(null, { status: 204 })],
      ["fails", Response.json({ message: "Erro." }, { status: 500 })],
    ])("accept a new change after one %s", async (_name, outcome) => {
      let result: Response | undefined = outcome;
      handler = (method) =>
        method === "PATCH" && result
          ? result
          : new Response(null, { status: 204 });
      renderRows([row("a")]);

      await choose("Item a", "menuitemradio", "Arquivado");
      await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
      result = undefined;
      await waitFor(() => expect(listFetches()).toBe(1));
      await choose("Item a", "menuitemradio", "Rascunho");

      await waitFor(() => expect(writes("PATCH")).toHaveLength(2));
    });
  });

  describe("Duplicar", () => {
    it("asks first, copies nothing when cancelled and returns focus to the menu button", async () => {
      renderRows([row("a")]);

      await choose("Item a", "menuitem", "Duplicar");
      const dialog = await screen.findByRole("alertdialog", {
        name: 'Duplicar "Item a"?',
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(writes("POST")).toEqual([]);
      await waitFor(() => expect(trigger("Item a")).toHaveFocus());
    });

    it("posts the copy for that row and opens it with the copied notice", async () => {
      handler = (method) =>
        method === "POST"
          ? Response.json({ id: "copy-1" }, { status: 201 })
          : new Response(null, { status: 204 });
      renderRows([row("a"), row("b")]);

      await choose("Item b", "menuitem", "Duplicar");
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/listings/copy-1?notice=copied",
        ),
      );
      expect(writes("POST")).toEqual([
        { url: "/stores/store/listings/b/duplicate", body: undefined },
      ]);
    });

    it("stays on the list with the copied toast when the answer cannot be read", async () => {
      handler = (method) =>
        method === "POST"
          ? Response.json({ unexpected: true }, { status: 201 })
          : new Response(null, { status: 204 });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      renderRows([row("a")]);

      await choose("Item a", "menuitem", "Duplicar");
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );

      expect(
        await screen.findByText(/Cópia criada como rascunho/),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it("cannot be dismissed while copying and offers Duplicar again after a failure", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "POST" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a")]);

      await choose("Item a", "menuitem", "Duplicar");
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );
      const dialog = screen.getByRole("alertdialog");
      await waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: "Duplicando..." }),
        ).toBeDisabled(),
      );
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      gate.resolve(problemResponse(500, "Servidor indisponível."));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      const menu = await openMenu("Item a");
      expect(
        within(menu).getByRole("menuitem", { name: "Duplicar" }),
      ).not.toHaveAttribute("aria-disabled");
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("Excluir", () => {
    it("deletes the listing, toasts once and moves focus to the heading", async () => {
      handler = (method) => {
        if (method === "DELETE") serverRows = [];
        return new Response(null, { status: 204 });
      };
      renderRows([row("a")]);

      await choose("Item a", "menuitem", "Excluir");
      fireEvent.click(
        await screen.findByRole("button", { name: "Excluir anúncio" }),
      );

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: "Anúncios" })).toHaveFocus(),
      );
      expect(writes("DELETE")).toEqual([
        { url: "/stores/store/listings/a", body: undefined },
      ]);
      expect(screen.getAllByText('"Item a" foi excluído.')).toHaveLength(1);
      expect(screen.queryByText("Item a")).toBeNull();
    });

    it("toasts the error once and keeps the dialog open when the deletion fails", async () => {
      handler = (method) =>
        method === "DELETE"
          ? problemResponse(500, "Servidor indisponível.")
          : new Response(null, { status: 204 });
      renderRows([row("a")]);

      await choose("Item a", "menuitem", "Excluir");
      fireEvent.click(
        await screen.findByRole("button", { name: "Excluir anúncio" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      expect(screen.getAllByText("Servidor indisponível.")).toHaveLength(1);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });
});

describe("buyer on the board", () => {
  it("sends no request, keeps the row available and returns focus to the menu button when the buyer dialog is cancelled", async () => {
    renderRows([row("a")]);
    await choose("Item a", "menuitemradio", "Reservado");
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(writes("PATCH")).toEqual([]);
    expect(situation("Item a")).toHaveTextContent("Disponível");
    await waitFor(() => expect(trigger("Item a")).toHaveFocus());
  });

  it("returns focus to the menu button when the sale details are closed", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    await choose("Item a", "menuitem", "Dados da venda");
    expect(
      await screen.findByRole("dialog", { name: 'Dados da venda de "Item a"' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(trigger("Item a")).toHaveFocus());
  });

  it("saves the buyer with the new availability in one request", async () => {
    renderRows([row("a", { priceCents: null })]);
    handler = () => {
      serverRows = [
        row("a", {
          availability: "sold",
          sale: ana({
            buyer: { id: "b-z", name: "Zeca" },
            agreedPriceCents: null,
          }),
        }),
      ];
      return new Response(null, { status: 204 });
    };
    await choose("Item a", "menuitemradio", "Vendido");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByRole("combobox", { name: "Nome do comprador" }),
      { target: { value: "Zeca" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Marcar como vendido" }),
    );
    await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
    expect(writes("PATCH")[0]).toEqual({
      url: "/stores/store/listings/a/status",
      body: JSON.stringify({
        availability: "sold",
        buyer: { name: "Zeca" },
        agreedPriceCents: null,
        paid: false,
        notes: null,
      }),
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(situation("Item a")).toHaveTextContent("Vendido"),
    );
    expect(await screen.findByText("Zeca")).toBeInTheDocument();
  });

  it("asks to confirm before releasing an item that has a buyer", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    await choose("Item a", "menuitemradio", "Disponível");
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Ana");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(writes("PATCH")).toEqual([]);
    expect(situation("Item a")).toHaveTextContent("Reservado");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    await waitFor(() => expect(trigger("Item a")).toHaveFocus());
  });

  it("releases the item and drops the buyer line once confirmed", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    handler = () => {
      serverRows = [row("a")];
      return new Response(null, { status: 204 });
    };
    await choose("Item a", "menuitemradio", "Disponível");
    fireEvent.click(
      await screen.findByRole("button", { name: "Voltar para disponível" }),
    );
    await waitFor(() =>
      expect(situation("Item a")).toHaveTextContent("Disponível"),
    );
    expect(writes("PATCH")).toEqual([
      {
        url: "/stores/store/listings/a/status",
        body: JSON.stringify({ availability: "available" }),
      },
    ]);
    expect(screen.queryByText("Ana")).toBeNull();
    await waitFor(() => expect(trigger("Item a")).toHaveFocus());
  });

  it("refreshes the buyers after a status change", async () => {
    const { client } = renderRows([
      row("a", { availability: "reserved", sale: ana() }),
    ]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await choose("Item a", "menuitemradio", "Disponível");
    fireEvent.click(
      await screen.findByRole("button", { name: "Voltar para disponível" }),
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["buyers", "store"],
      }),
    );
  });

  it("shows the buyer on a sold row", () => {
    renderRows([row("a", { availability: "sold", sale: ana() })]);
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("shows Sem comprador on a legacy sold row and opens the dialog from Adicionar comprador", async () => {
    renderRows([row("a", { availability: "sold" })]);
    expect(screen.getByText("Sem comprador")).toBeInTheDocument();
    const menu = await openMenu("Item a");
    expect(
      within(menu).queryByRole("menuitem", { name: /^Marcar como/ }),
    ).toBeNull();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Adicionar comprador" }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: 'Adicionar comprador a "Item a"',
      }),
    ).toBeInTheDocument();
  });

  it("shows no buyer line, paid choice or sale action on an available row", async () => {
    renderRows([row("a")]);
    expect(screen.queryByText("Sem comprador")).toBeNull();
    const menu = await openMenu("Item a");
    expect(
      within(menu).queryByRole("menuitem", {
        name: /^Marcar como|comprador|venda/,
      }),
    ).toBeNull();
  });

  it("saves an edited agreed price from the sale details without changing availability", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    await choose("Item a", "menuitem", "Dados da venda");
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Valor combinado (R$)"), {
      target: { value: "60,00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
    expect(writes("PATCH")[0]).toEqual({
      url: "/stores/store/listings/a/sale",
      body: JSON.stringify({
        buyer: { id: "b-ana" },
        agreedPriceCents: 6000,
        paid: false,
        notes: null,
      }),
    });
    expect(situation("Item a")).toHaveTextContent("Reservado");
  });

  describe("paid toggle", () => {
    it("sends paid, shows Pago and then offers to undo it", async () => {
      renderRows([row("a", { availability: "sold", sale: ana() })]);
      handler = () => {
        serverRows = [
          row("a", { availability: "sold", sale: ana({ paid: true }) }),
        ];
        return new Response(null, { status: 204 });
      };
      await choose("Item a", "menuitem", "Marcar como pago");
      await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
      expect(writes("PATCH")[0]).toEqual({
        url: "/stores/store/listings/a/sale",
        body: JSON.stringify({ paid: true }),
      });
      expect(situation("Item a")).toHaveTextContent(/^VendidoPago$/);

      await waitFor(() => expect(listFetches()).toBe(1));
      await choose("Item a", "menuitem", "Marcar como não pago");
      await waitFor(() => expect(writes("PATCH")).toHaveLength(2));
      expect(writes("PATCH")[1]).toEqual({
        url: "/stores/store/listings/a/sale",
        body: JSON.stringify({ paid: false }),
      });
    });

    it("returns to unpaid with an error toast when the save fails", async () => {
      handler = (method) =>
        method === "PATCH"
          ? problemResponse(500, "Servidor indisponível.")
          : new Response(null, { status: 204 });
      renderRows([row("a", { availability: "sold", sale: ana() })]);
      await choose("Item a", "menuitem", "Marcar como pago");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      await waitFor(() =>
        expect(situation("Item a")).toHaveTextContent("Não pago"),
      );
      const menu = await openMenu("Item a");
      expect(
        within(menu).getByRole("menuitem", { name: "Marcar como pago" }),
      ).toBeInTheDocument();
    });
  });

  describe("delete warning", () => {
    const openDelete = async () => {
      await choose("Item a", "menuitem", "Excluir");
      return screen.findByRole("alertdialog");
    };

    it("names the unpaid buyer and the amount that stops counting", async () => {
      renderRows([row("a", { availability: "sold", sale: ana() })]);
      const dialog = await openDelete();
      expect(dialog).toHaveTextContent("Ana");
      expect(dialog).toHaveTextContent("R$ 100,00");
    });

    it.each([
      ["a paid buyer", { availability: "sold", sale: ana({ paid: true }) }],
      ["no buyer", { availability: "sold" }],
    ] as const)("keeps the usual text for %s", async (_name, overrides) => {
      renderRows([row("a", overrides)]);
      const dialog = await openDelete();
      expect(dialog).not.toHaveTextContent("dívida");
    });
  });
});
