import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { stubAdminApi } from "@/test/admin-api";
import { buyerSummary, meResponse } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { BuyersPage } from "../admin-buyers-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const item = (
  overrides: Partial<ReturnType<typeof buyerSummary>["items"][number]> = {},
) => ({
  listingId: "l-1",
  title: "Sofá",
  availability: "sold" as const,
  agreedPriceCents: 10000,
  paid: false,
  ...overrides,
});

const ana = buyerSummary({
  id: "b-ana",
  name: "Ana",
  whatsappNumber: "5511911112222",
  linkedCount: 2,
  items: [
    item(),
    item({
      listingId: "l-2",
      title: "Mesa",
      availability: "reserved",
      agreedPriceCents: null,
    }),
  ],
  owedCents: 10000,
  unpricedCount: 1,
});
const alvaro = buyerSummary({
  id: "b-alvaro",
  name: "Álvaro",
  linkedCount: 1,
  items: [item({ listingId: "l-3", title: "Cadeira", paid: true })],
  owedCents: 0,
});
const bruno = buyerSummary({ id: "b-bruno", name: "bruno", owedCents: 2500 });
const maria = buyerSummary({ id: "b-maria", name: "Maria Sílva" });

async function renderBuyers(
  buyers: ReturnType<typeof buyerSummary>[],
  role: "owner" | "seller" = "owner",
  search = "",
) {
  stubAdminApi({
    "/me": meResponse(role),
    "/stores/store-1/buyers": { items: buyers },
  });
  const onUrlUpdate = vi.fn();
  const Nuqs = withNuqsTestingAdapter({
    searchParams: search,
    onUrlUpdate,
    hasMemory: true,
  });
  renderPage(<Nuqs>{await BuyersPage()}</Nuqs>);
  return () => new URLSearchParams(onUrlUpdate.mock.lastCall?.[0].queryString);
}

const NAMES = ["Álvaro", "Ana", "bruno", "Maria Sílva"];
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => NAMES.find((name) => row.textContent?.startsWith(name)));

/** Matches the element whose whole text, screen-reader-only parts included, is `full`. */
const text = (full: string) => (_: string, element: Element | null) =>
  element?.textContent === full;

const sortSelect = () => screen.getByRole("combobox", { name: /^Ordenar:/ });

async function pick(trigger: HTMLElement, option: string) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.keyDown(await screen.findByRole("option", { name: option }), {
    key: "Enter",
  });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

describe("buyers page", () => {
  it("links a buyer's number to their WhatsApp chat", async () => {
    await renderBuyers([ana]);
    expect(
      screen.getByRole("link", { name: /^WhatsApp de Ana/ }),
    ).toHaveAttribute("href", "https://wa.me/5511911112222");
  });

  it("shows each item's availability, agreed price and payment, and what the buyer owes", async () => {
    await renderBuyers([ana]);
    const row = screen.getByRole("row", { name: /Ana/ });
    expect(within(row).getByRole("link", { name: "Sofá" })).toHaveAttribute(
      "href",
      "/admin/listings/l-1",
    );
    expect(within(row).getByText("Vendido")).toBeInTheDocument();
    expect(
      within(row).getByText(text("R$ 100,00, Não pago")),
    ).toBeInTheDocument();
    expect(within(row).getByText("Reservado")).toBeInTheDocument();
    expect(
      within(row).getByText(text("Sem preço, Não pago")),
    ).toBeInTheDocument();
    expect(
      within(row).getByText(text("R$ 100,00 a receber")),
    ).toBeInTheDocument();
    expect(within(row).getByText("+ 1 item sem preço")).toBeInTheDocument();
  });

  it("marks a settled item as paid and the buyer as settled", async () => {
    await renderBuyers([alvaro]);
    const row = screen.getByRole("row", { name: /Álvaro/ });
    expect(within(row).getByText(text("R$ 100,00, Pago"))).toBeInTheDocument();
    expect(within(row).queryByText(/Não pago/)).toBeNull();
    expect(within(row).getByText("Quitado")).toBeInTheDocument();
  });

  it("counts the unpriced items of a buyer who owes no known amount", async () => {
    await renderBuyers([
      buyerSummary({
        id: "b-caio",
        name: "Caio",
        items: [item({ agreedPriceCents: null })],
        owedCents: 0,
        unpricedCount: 1,
      }),
    ]);
    expect(screen.getByText("1 item sem preço")).toBeInTheDocument();
    expect(screen.queryByText("Quitado")).toBeNull();
  });

  it("totals what the shown buyers owe", async () => {
    await renderBuyers([ana, bruno]);
    expect(screen.getByTestId("buyers-total")).toHaveTextContent("R$ 125,00");

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "bru" },
    });
    expect(await screen.findByTestId("buyers-total")).toHaveTextContent(
      "R$ 25,00",
    );
  });

  it("finds buyers ignoring case and accents, and says when none match", async () => {
    await renderBuyers([ana, alvaro, maria]);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "silv" },
    });
    expect(await screen.findByText("Maria Sílva")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzz" },
    });
    expect(
      await screen.findByText('Nenhum comprador com "zzz".'),
    ).toBeInTheDocument();
  });

  it("orders by what is owed, then by name", async () => {
    await renderBuyers([maria, bruno, alvaro, ana]);
    expect(names()).toEqual(["Ana", "bruno", "Álvaro", "Maria Sílva"]);
  });

  it("sorts by name ignoring case and accents from the Ordenar select, and back by amount", async () => {
    const url = await renderBuyers([maria, bruno, alvaro, ana]);
    expect(sortSelect()).toHaveAccessibleName("Ordenar: Maior valor a receber");

    await pick(sortSelect(), "Nome");
    await waitFor(() =>
      expect(names()).toEqual(["Álvaro", "Ana", "bruno", "Maria Sílva"]),
    );
    expect(url().get("buyers-sort")).toBe("name-asc");
    expect(sortSelect()).toHaveAccessibleName("Ordenar: Nome");

    await pick(sortSelect(), "Maior valor a receber");
    await waitFor(() =>
      expect(names()).toEqual(["Ana", "bruno", "Álvaro", "Maria Sílva"]),
    );
  });

  it.each([
    [
      "by name",
      "?buyers-sort=name-asc",
      ["Álvaro", "Ana", "bruno", "Maria Sílva"],
    ],
    [
      "by amount for any other order",
      "?buyers-sort=name-desc",
      ["Ana", "bruno", "Álvaro", "Maria Sílva"],
    ],
  ])("reads the sort from the URL, %s", async (_name, search, order) => {
    await renderBuyers([maria, bruno, alvaro, ana], "owner", search);
    expect(names()).toEqual(order);
  });

  it("says there are no buyers yet", async () => {
    await renderBuyers([]);
    expect(screen.getByText("Nenhum comprador ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("tells a seller the items are their own and says when a buyer has none of theirs", async () => {
    await renderBuyers([maria], "seller");
    expect(
      screen.getByText("Itens e valores dos seus anúncios."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum item seu")).toBeInTheDocument();
  });

  it("gives every row an actions menu", async () => {
    await renderBuyers([ana], "seller");
    expect(
      screen.getByRole("button", { name: "Ações para Ana" }),
    ).toBeInTheDocument();
  });
});
