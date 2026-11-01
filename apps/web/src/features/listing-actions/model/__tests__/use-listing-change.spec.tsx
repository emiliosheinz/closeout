import { dehydrate, QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { listingKeys } from "@/entities/listing";
import { renderWithFeedback } from "@/test/feedback-harness";
import { listingSummary, problemResponse } from "@/test/fixtures";
import type { StatusChange } from "../status-change";
import { useListingChange } from "../use-listing-change";
import { useListings } from "../use-listings";

const sale = {
  buyer: { id: "b-1", name: "Ana" },
  agreedPriceCents: 7000,
  paid: false,
  notes: null,
};
const reservedRow = listingSummary({
  id: "a",
  title: "Sofá azul",
  availability: "reserved",
  sale,
});

let respond: () => Response | Promise<Response>;
let listFetches: number;

beforeEach(() => {
  listFetches = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit = {}) => {
      if (init.method === "GET") {
        listFetches += 1;
        return Response.json({ items: [reservedRow] });
      }
      return respond();
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function Host({ change }: { change: StatusChange }) {
  const [row] = useListings("store");
  const mutation = useListingChange("store");
  return (
    <>
      <output data-testid="sale">{JSON.stringify(row?.sale)}</output>
      <button type="button" onClick={() => mutation.mutate(change)}>
        save
      </button>
    </>
  );
}

function renderHost(change: StatusChange) {
  const seed = new QueryClient();
  seed.setQueryData(listingKeys.list("store"), { items: [reservedRow] });
  return renderWithFeedback(<Host change={change} />, dehydrate(seed));
}

const shownSale = () =>
  JSON.parse(screen.getByTestId("sale").textContent ?? "null");

describe("a pending board change", () => {
  it("shows a pending sale over the cached row", async () => {
    let finish!: (response: Response) => void;
    respond = () => new Promise<Response>((r) => (finish = r));
    const next = { ...sale, buyer: { id: "", name: "Bia" } };
    renderHost({
      id: "a",
      title: "Sofá azul",
      patch: { sale: next },
      body: {},
      route: "sale",
    });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(shownSale().buyer.name).toBe("Bia"));
    await act(async () => finish(new Response(null, { status: 204 })));
  });

  it("flips only the paid flag for a pending paid patch", async () => {
    respond = () => new Promise<Response>(() => {});
    renderHost({
      id: "a",
      title: "Sofá azul",
      patch: { sale: { ...sale, paid: true } },
      body: { paid: true },
      route: "sale",
    });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(shownSale().paid).toBe(true));
    expect(shownSale()).toEqual({ ...sale, paid: true });
  });

  it("shows the server value again after the save fails", async () => {
    respond = () => problemResponse(500, "Servidor indisponível.");
    renderHost({
      id: "a",
      title: "Sofá azul",
      patch: { sale: { ...sale, paid: true } },
      body: { paid: true },
      route: "sale",
    });
    fireEvent.click(screen.getByText("save"));
    await screen.findByRole("alert");
    await waitFor(() => expect(shownSale().paid).toBe(false));
  });

  it("refetches the listings once the change settles", async () => {
    respond = () => new Response(null, { status: 204 });
    renderHost({
      id: "a",
      title: "Sofá azul",
      patch: { sale: { ...sale, paid: true } },
      body: { paid: true },
      route: "sale",
    });
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(listFetches).toBeGreaterThan(0));
  });
});
