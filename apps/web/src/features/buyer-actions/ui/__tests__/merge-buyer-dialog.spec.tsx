import { fireEvent, screen, waitFor } from "@testing-library/react";
import { buyerKeys } from "@/entities/buyer";
import { listingKeys } from "@/entities/listing";
import { renderWithFeedback } from "@/test/feedback-harness";
import { buyerSummary } from "@/test/fixtures";
import { MergeBuyerDialog } from "../merge-buyer-dialog";

const ana = buyerSummary({
  id: "b-ana",
  name: "Ana",
  whatsappNumber: "5511911112222",
  linkedCount: 2,
});
const bruno = buyerSummary({ id: "b-bruno", name: "Bruno" });
const bia = buyerSummary({
  id: "b-bia",
  name: "Bia",
  whatsappNumber: "5521933334444",
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init: RequestInit = {}) =>
    init.method === "GET"
      ? Response.json({ items: [ana, bruno, bia] })
      : new Response(null, { status: 204 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const posts = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) =>
        String(url).startsWith("/api/v1") &&
        (init as RequestInit)?.method === "POST",
    )
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      body: (init as RequestInit).body,
    }));

async function renderDialog() {
  const onClose = vi.fn();
  const view = renderWithFeedback(
    <MergeBuyerDialog storeId="store" source={ana} onClose={onClose} />,
  );
  const input = screen.getByRole("combobox", { name: "Juntar com" });
  return { ...view, input, onClose };
}

async function pick(input: HTMLElement, typed: string, label: string) {
  fireEvent.change(input, { target: { value: typed } });
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

describe("MergeBuyerDialog", () => {
  it("offers the other buyers and never the one being merged", async () => {
    const { input } = await renderDialog();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: "b" } });
    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Bruno", "Bia"]);
    fireEvent.change(input, { target: { value: "ana" } });
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("keeps saving off until a buyer is picked", async () => {
    const { input } = await renderDialog();
    const save = screen.getByRole("button", { name: "Juntar compradores" });
    expect(save).toBeDisabled();
    await pick(input, "bru", "Bruno");
    expect(save).toBeEnabled();
    fireEvent.change(input, { target: { value: "bru" } });
    expect(save).toBeDisabled();
  });

  it("says the items and the phone move to a target without a phone", async () => {
    const { input } = await renderDialog();
    await pick(input, "bru", "Bruno");
    expect(
      screen.getByText(
        "2 itens de Ana passam para Bruno. Bruno recebe o WhatsApp +5511911112222 de Ana. Ana deixa de existir.",
      ),
    ).toBeInTheDocument();
  });

  it("says the target keeps its own phone", async () => {
    const { input } = await renderDialog();
    await pick(input, "bia", "Bia");
    expect(
      screen.getByText(
        "2 itens de Ana passam para Bia. Bia mantém o WhatsApp +5521933334444. Ana deixa de existir.",
      ),
    ).toBeInTheDocument();
  });

  it("posts the target, refreshes buyers and listings and closes", async () => {
    const { input, client, onClose } = await renderDialog();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await pick(input, "bru", "Bruno");
    fireEvent.click(screen.getByRole("button", { name: "Juntar compradores" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posts()).toEqual([
      {
        url: "/stores/store/buyers/b-ana/merge",
        body: JSON.stringify({ targetId: "b-bruno" }),
      },
    ]);
    const keys = invalidate.mock.calls.map(([filter]) => filter?.queryKey);
    expect(keys).toContainEqual(buyerKeys.all("store"));
    expect(keys).toContainEqual(listingKeys.all("store"));
  });
});
