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
  ListingStatusControls,
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
              <td>
                <ListingStatusControls storeId="store" listing={listing} />
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

const status = (kind: "Publicação" | "Disponibilidade", title: string) =>
  screen.getByRole("combobox", {
    name: `${kind} de ${title}`,
    // An open buyer dialog hides the table from the accessibility tree.
    hidden: true,
  });

async function pick(trigger: HTMLElement, option: string) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  const choice = await screen.findByRole("option", { name: option });
  fireEvent.keyDown(choice, { key: "Enter" });
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
}

/**
 * Picks Reservado or Vendido and submits the buyer dialog. The dialog stays
 * open until the answer arrives, so callers resolve the request to close it.
 */
async function sell(trigger: HTMLElement, option: "Reservado" | "Vendido") {
  const sent = writes("PATCH").length;
  await pick(trigger, option);
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
    ["nosso-desapego", "/store/nosso-desapego/items/a"],
    ["loja-da-bia", "/store/loja-da-bia/items/a"],
  ])("links published items to their page in %s", (slug, href) => {
    renderRows([row("a")], { storeSlug: slug });
    expect(
      screen.getByRole("link", { name: "Ver Item a na loja" }),
    ).toHaveAttribute("href", href);
  });

  it("links unpublished items to the admin preview", () => {
    renderRows([row("b", { publication: "draft" })]);
    expect(
      screen.getByRole("link", { name: "Pré-visualizar Item b" }),
    ).toHaveAttribute("href", "/admin/listings/b/preview");
  });

  it("names each status control after its item and shows the selected label", () => {
    renderRows([row("a"), row("b", { publication: "draft" })]);
    expect(status("Publicação", "Item a")).toHaveTextContent("Publicado");
    expect(status("Publicação", "Item b")).toHaveTextContent("Rascunho");
    expect(status("Disponibilidade", "Item a")).toHaveTextContent("Disponível");
  });

  it("lists the availability options and sends the chosen one", async () => {
    renderRows([row("a")]);
    const trigger = status("Disponibilidade", "Item a");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Disponível",
      "Reservado",
      "Vendido",
    ]);
    fireEvent.keyDown(options[0] as HTMLElement, { key: "ArrowDown" });
    await waitFor(() => expect(options[1]).toHaveFocus());
    fireEvent.keyDown(options[1] as HTMLElement, { key: "Enter" });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(writes("PATCH")).toEqual([]);
  });

  it("sends only the publication when it changes", async () => {
    renderRows([row("a")]);
    const trigger = status("Publicação", "Item a");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = await screen.findAllByRole("option");
    const published = options.findIndex(
      (option) => option.getAttribute("aria-selected") === "true",
    );
    fireEvent.keyDown(options[published] as HTMLElement, { key: "ArrowDown" });
    await waitFor(() => expect(options[published + 1]).toHaveFocus());
    fireEvent.keyDown(options[published + 1] as HTMLElement, { key: "Enter" });

    await waitFor(() =>
      expect(writes("PATCH")).toEqual([
        {
          url: "/stores/store/listings/a/status",
          body: JSON.stringify({ publication: "archived" }),
        },
      ]),
    );
  });

  describe("status changes", () => {
    it("show the new value and the counts before the response, then toast once", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a"), row("b")]);

      await sell(status("Disponibilidade", "Item a"), "Reservado");

      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Reservado",
      );
      expect(status("Disponibilidade", "Item b")).toHaveTextContent(
        "Disponível",
      );
      expect(screen.getByTestId("reserved")).toHaveTextContent("1");

      gate.resolve(new Response(null, { status: 204 }));
      expect(
        await screen.findByText('"Item a" reservado para Zeca.'),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/reservado para/)).toHaveLength(1);
    });

    it("say the publication in lowercase in the toast", async () => {
      renderRows([row("a")]);
      await pick(status("Publicação", "Item a"), "Rascunho");
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await sell(status("Disponibilidade", "Item b"), "Vendido");
      first.resolve(problemResponse(500, "Servidor indisponível."));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      await waitFor(() =>
        expect(status("Disponibilidade", "Item a")).toHaveTextContent(
          "Disponível",
        ),
      );
      expect(status("Disponibilidade", "Item b")).toHaveTextContent("Vendido");
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await client.refetchQueries({ queryKey: listingKeys.list("store") });

      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Reservado",
      );
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await sell(status("Disponibilidade", "Item b"), "Vendido");
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

      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Reservado",
      );
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await sell(status("Disponibilidade", "Item b"), "Vendido");
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await sell(status("Disponibilidade", "Item b"), "Vendido");
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" reservado para Zeca.');

      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Reservado",
      );
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

      fireEvent.click(screen.getByRole("button", { name: "Duplicar Item b" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );
      await waitFor(() => expect(writes("POST")).toHaveLength(1));
      // Closing the confirmation leaves the copy request running.
      fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      await sell(status("Disponibilidade", "Item a"), "Reservado");

      await screen.findByText('"Item a" reservado para Zeca.');
      await waitFor(() => expect(listFetches()).toBe(1));
      copying.resolve(Response.json({ message: "Erro." }, { status: 500 }));
    });

    it("ignore another change on the same row while one is pending", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a")]);

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await pick(status("Publicação", "Item a"), "Arquivado");

      expect(writes("PATCH")).toHaveLength(1);
      expect(status("Publicação", "Item a")).toHaveTextContent("Publicado");
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

      await sell(status("Disponibilidade", "Item a"), "Reservado");
      await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
      result = new Response(null, { status: 204 });
      await waitFor(() =>
        expect(status("Disponibilidade", "Item a")).toBeInTheDocument(),
      );
      await pick(status("Publicação", "Item a"), "Arquivado");

      await waitFor(() => expect(writes("PATCH")).toHaveLength(2));
    });
  });

  it("labels each icon action on keyboard focus", async () => {
    renderRows([row("a")]);
    for (const [name, label] of [
      ["Editar Item a", "Editar"],
      ["Duplicar Item a", "Duplicar"],
      ["Excluir Item a", "Excluir"],
    ] as const) {
      act(() =>
        (
          screen.queryByRole("link", { name }) ??
          screen.getByRole("button", { name })
        ).focus(),
      );
      await waitFor(() =>
        expect(screen.getByRole("tooltip")).toHaveTextContent(label),
      );
    }
  });

  describe("Duplicar", () => {
    it("asks first and copies nothing when cancelled", async () => {
      renderRows([row("a")]);

      fireEvent.click(screen.getByRole("button", { name: "Duplicar Item a" }));
      const dialog = await screen.findByRole("alertdialog", {
        name: 'Duplicar "Item a"?',
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(writes("POST")).toEqual([]);
    });

    it("posts the copy for that row and opens it with the copied notice", async () => {
      handler = (method) =>
        method === "POST"
          ? Response.json({ id: "copy-1" }, { status: 201 })
          : new Response(null, { status: 204 });
      renderRows([row("a"), row("b")]);

      fireEvent.click(screen.getByRole("button", { name: "Duplicar Item b" }));
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

      fireEvent.click(screen.getByRole("button", { name: "Duplicar Item a" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );

      expect(
        await screen.findByText(/Cópia criada como rascunho/),
      ).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it("disables the button while copying and enables it after a failure", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "POST" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a")]);
      const button = screen.getByRole("button", { name: "Duplicar Item a" });

      fireEvent.click(button);
      fireEvent.click(
        await screen.findByRole("button", { name: "Duplicar anúncio" }),
      );
      await waitFor(() => expect(button).toBeDisabled());
      gate.resolve(problemResponse(500, "Servidor indisponível."));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      await waitFor(() => expect(button).toBeEnabled());
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

      fireEvent.click(screen.getByRole("button", { name: "Excluir Item a" }));
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
      expect(screen.queryByRole("link", { name: "Item a" })).toBeNull();
    });

    it("toasts the error once and keeps the dialog open when the deletion fails", async () => {
      handler = (method) =>
        method === "DELETE"
          ? problemResponse(500, "Servidor indisponível.")
          : new Response(null, { status: 204 });
      renderRows([row("a")]);

      fireEvent.click(screen.getByRole("button", { name: "Excluir Item a" }));
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

const ana = (overrides: Partial<NonNullable<Row["sale"]>> = {}) => ({
  buyer: { id: "b-ana", name: "Ana" },
  agreedPriceCents: 10000,
  paid: false,
  notes: null,
  ...overrides,
});

describe("buyer on the board", () => {
  it("sends no request and keeps the row available when the buyer dialog is cancelled", async () => {
    renderRows([row("a")]);
    await pick(status("Disponibilidade", "Item a"), "Reservado");
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(writes("PATCH")).toEqual([]);
    expect(status("Disponibilidade", "Item a")).toHaveTextContent("Disponível");
  });

  it("returns focus to the availability select when the buyer dialog is cancelled", async () => {
    renderRows([row("a")]);
    await pick(status("Disponibilidade", "Item a"), "Reservado");
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(status("Disponibilidade", "Item a")).toHaveFocus(),
    );
  });

  it("returns focus to the buyer button when the buyer details are closed", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    const button = screen.getByRole("button", { name: "Comprador de Item a" });
    button.focus();
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(button).toHaveFocus());
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
    await pick(status("Disponibilidade", "Item a"), "Vendido");
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
      expect(status("Disponibilidade", "Item a")).toHaveTextContent("Vendido"),
    );
    expect(await screen.findByText("Zeca")).toBeInTheDocument();
  });

  it("asks to confirm before releasing an item that has a buyer", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    await pick(status("Disponibilidade", "Item a"), "Disponível");
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Ana");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(writes("PATCH")).toEqual([]);
    expect(status("Disponibilidade", "Item a")).toHaveTextContent("Reservado");
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("releases the item and drops the buyer line once confirmed", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    handler = () => {
      serverRows = [row("a")];
      return new Response(null, { status: 204 });
    };
    await pick(status("Disponibilidade", "Item a"), "Disponível");
    fireEvent.click(
      await screen.findByRole("button", { name: "Voltar para disponível" }),
    );
    await waitFor(() =>
      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Disponível",
      ),
    );
    expect(writes("PATCH")).toEqual([
      {
        url: "/stores/store/listings/a/status",
        body: JSON.stringify({ availability: "available" }),
      },
    ]);
    expect(screen.queryByText("Ana")).toBeNull();
  });

  it("refreshes the buyers after a status change", async () => {
    const { client } = renderRows([
      row("a", { availability: "reserved", sale: ana() }),
    ]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await pick(status("Disponibilidade", "Item a"), "Disponível");
    fireEvent.click(
      await screen.findByRole("button", { name: "Voltar para disponível" }),
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["buyers", "store"],
      }),
    );
  });

  it("shows the buyer and Não pago on an unpaid sold row", () => {
    renderRows([row("a", { availability: "sold", sale: ana() })]);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Não pago")).toBeInTheDocument();
  });

  it("shows the buyer without Não pago once paid", () => {
    renderRows([row("a", { availability: "sold", sale: ana({ paid: true }) })]);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Não pago")).toBeNull();
  });

  it("shows Sem comprador on a legacy sold row and opens the dialog from Adicionar comprador", async () => {
    renderRows([row("a", { availability: "sold" })]);
    expect(screen.getByText("Sem comprador")).toBeInTheDocument();
    expect(screen.queryByText("Não pago")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar comprador a Item a" }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows no buyer line, paid control or buyer action on an available row", () => {
    renderRows([row("a")]);
    expect(screen.queryByText("Sem comprador")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /comprador/i })).toBeNull();
  });

  it("saves an edited agreed price from the buyer details without changing availability", async () => {
    renderRows([row("a", { availability: "reserved", sale: ana() })]);
    fireEvent.click(
      screen.getByRole("button", { name: "Comprador de Item a" }),
    );
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
    expect(status("Disponibilidade", "Item a")).toHaveTextContent("Reservado");
  });

  describe("paid toggle", () => {
    it("sends paid and drops Não pago when ticked", async () => {
      renderRows([row("a", { availability: "sold", sale: ana() })]);
      handler = () => {
        serverRows = [
          row("a", { availability: "sold", sale: ana({ paid: true }) }),
        ];
        return new Response(null, { status: 204 });
      };
      fireEvent.click(screen.getByRole("checkbox", { name: "Pago — Item a" }));
      await waitFor(() => expect(writes("PATCH")).toHaveLength(1));
      expect(writes("PATCH")[0]).toEqual({
        url: "/stores/store/listings/a/sale",
        body: JSON.stringify({ paid: true }),
      });
      expect(screen.queryByText("Não pago")).toBeNull();
    });

    it("returns to unticked with an error toast when the save fails", async () => {
      handler = (method) =>
        method === "PATCH"
          ? problemResponse(500, "Servidor indisponível.")
          : new Response(null, { status: 204 });
      renderRows([row("a", { availability: "sold", sale: ana() })]);
      const box = screen.getByRole("checkbox", { name: "Pago — Item a" });
      fireEvent.click(box);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Servidor indisponível.",
      );
      await waitFor(() => expect(box).not.toBeChecked());
      expect(screen.getByText("Não pago")).toBeInTheDocument();
    });
  });

  describe("delete warning", () => {
    const openDelete = async () => {
      fireEvent.click(screen.getByRole("button", { name: "Excluir Item a" }));
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
