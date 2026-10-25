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
import { listingSummary } from "@/test/fixtures";
import { useListings } from "../../model/use-listings";
import { ListingRowActions, ListingStatusControls } from "../listing-rows";

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
              <td>{listing.title}</td>
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
  screen.getByRole("combobox", { name: `${kind} de ${title}` });

async function pick(trigger: HTMLElement, option: string) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  const choice = await screen.findByRole("option", { name: option });
  fireEvent.keyDown(choice, { key: "Enter" });
  await waitFor(() =>
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
  );
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
    ).toHaveAttribute("href", "/admin/anuncios/b/previa");
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

    await waitFor(() =>
      expect(writes("PATCH")).toEqual([
        {
          url: "/stores/store/listings/a/status",
          body: JSON.stringify({ availability: "reserved" }),
        },
      ]),
    );
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");

      expect(status("Disponibilidade", "Item a")).toHaveTextContent(
        "Reservado",
      );
      expect(status("Disponibilidade", "Item b")).toHaveTextContent(
        "Disponível",
      );
      expect(screen.getByTestId("reserved")).toHaveTextContent("1");

      gate.resolve(new Response(null, { status: 204 }));
      expect(
        await screen.findByText('"Item a" marcado como reservado.'),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/marcado como/)).toHaveLength(1);
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
      await pick(status("Disponibilidade", "Item b"), "Vendido");
      first.resolve(
        Response.json({ message: "Servidor indisponível." }, { status: 500 }),
      );

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
        expect(
          screen.getByText('"Item b" marcado como vendido.'),
        ).toBeVisible(),
      );
    });

    it("survive a refetch that lands while they are pending", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      const { client } = renderRows([row("a")]);

      await pick(status("Disponibilidade", "Item a"), "Reservado");
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
      await pick(status("Disponibilidade", "Item b"), "Vendido");
      listResponse = () => refetch.promise;
      const inFlight = client.refetchQueries({
        queryKey: listingKeys.list("store"),
      });
      await waitFor(() => expect(listFetches()).toBe(1));
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" marcado como reservado.');
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
      await pick(status("Disponibilidade", "Item b"), "Vendido");
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" marcado como reservado.');
      expect(listFetches()).toBe(0);

      second.resolve(new Response(null, { status: 204 }));
      await waitFor(() => expect(listFetches()).toBe(1));
      await screen.findByText('"Item b" marcado como vendido.');
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
      await pick(status("Disponibilidade", "Item b"), "Vendido");
      first.resolve(new Response(null, { status: 204 }));
      await screen.findByText('"Item a" marcado como reservado.');

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
      await pick(status("Disponibilidade", "Item a"), "Reservado");

      await screen.findByText('"Item a" marcado como reservado.');
      await waitFor(() => expect(listFetches()).toBe(1));
      copying.resolve(Response.json({ message: "Erro." }, { status: 500 }));
    });

    it("ignore another change on the same row while one is pending", async () => {
      const gate = deferred();
      handler = (method) =>
        method === "PATCH" ? gate.promise : new Response(null, { status: 204 });
      renderRows([row("a")]);

      await pick(status("Disponibilidade", "Item a"), "Reservado");
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

      await pick(status("Disponibilidade", "Item a"), "Reservado");
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
        expect(push).toHaveBeenCalledWith("/admin/anuncios/copy-1?copiado=1"),
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
      gate.resolve(
        Response.json({ message: "Servidor indisponível." }, { status: 500 }),
      );

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
          ? Response.json(
              { message: "Servidor indisponível." },
              { status: 500 },
            )
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
