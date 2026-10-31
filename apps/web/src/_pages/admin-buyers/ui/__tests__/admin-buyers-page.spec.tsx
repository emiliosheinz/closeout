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

const Nuqs = withNuqsTestingAdapter();

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
) {
  stubAdminApi({
    "/me": meResponse(role),
    "/stores/store-1/buyers": { items: buyers },
  });
  renderPage(<Nuqs>{await BuyersPage()}</Nuqs>);
}

const NAMES = ["Álvaro", "Ana", "bruno", "Maria Sílva"];
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => NAMES.find((name) => row.textContent?.startsWith(name)));

describe("buyers page", () => {
  it("links a buyer with a phone to their WhatsApp chat", async () => {
    await renderBuyers([ana]);
    expect(screen.getByRole("link", { name: "Ana" })).toHaveAttribute(
      "href",
      "https://wa.me/5511911112222",
    );
  });

  it("shows each item's availability, agreed price and payment, and counts the unpriced ones", async () => {
    await renderBuyers([ana]);
    const row = screen.getByRole("row", { name: /Ana/ });
    expect(within(row).getByRole("link", { name: "Sofá" })).toHaveAttribute(
      "href",
      "/admin/listings/l-1",
    );
    expect(within(row).getByText("Vendido")).toBeInTheDocument();
    expect(within(row).getAllByText("R$ 100,00")).toHaveLength(2);
    expect(within(row).getByText("Reservado")).toBeInTheDocument();
    expect(within(row).getAllByText("Não pago")).toHaveLength(2);
    expect(within(row).getByText("1 sem preço")).toBeInTheDocument();
  });

  it("marks a settled item as paid", async () => {
    await renderBuyers([alvaro]);
    const row = screen.getByRole("row", { name: /Álvaro/ });
    expect(within(row).getByText("Pago")).toBeInTheDocument();
    expect(within(row).queryByText("Não pago")).toBeNull();
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

  it("sorts by name ignoring case and accents, and reverses on a second click", async () => {
    await renderBuyers([maria, bruno, alvaro, ana]);
    const byName = screen.getByRole("button", { name: /Comprador/ });
    fireEvent.click(byName);
    await waitFor(() =>
      expect(names()).toEqual(["Álvaro", "Ana", "bruno", "Maria Sílva"]),
    );

    fireEvent.click(byName);
    await waitFor(() =>
      expect(names()).toEqual(["Maria Sílva", "bruno", "Ana", "Álvaro"]),
    );
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
