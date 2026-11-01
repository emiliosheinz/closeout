import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithFeedback } from "@/test/feedback-harness";
import { buyerSummary, listingSummary, problemResponse } from "@/test/fixtures";
import { BuyerDialog } from "../buyer-dialog";

type Listing = ReturnType<typeof listingSummary>;

let buyers: ReturnType<typeof buyerSummary>[];
let buyersStatus: number;
let patchResponse: () => Response | Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
const onClose = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  buyers = [];
  buyersStatus = 200;
  patchResponse = () => new Response(null, { status: 204 });
  fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const path = String(url).replace("/api/v1", "");
    if (init.method === "GET" && path === "/stores/store/buyers") {
      return buyersStatus === 200
        ? Response.json({ items: buyers })
        : problemResponse(buyersStatus, "Falhou.");
    }
    if (init.method === "GET") return Response.json({ items: [] });
    return patchResponse();
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const available = () =>
  listingSummary({ id: "l-1", title: "Sofá azul", priceCents: 8000 });

function open(listing: Listing, availability?: "reserved" | "sold") {
  return renderWithFeedback(
    <BuyerDialog
      storeId="store"
      listing={listing}
      availability={availability}
      onClose={onClose}
    />,
  );
}

// The buyers query resolves on a timer, not a microtask.
const buyersLoaded = () => new Promise((r) => setTimeout(r, 30));
const nameInput = () =>
  screen.getByRole("combobox", { name: "Nome do comprador" });
const typeName = (value: string) =>
  fireEvent.change(nameInput(), { target: { value } });
const save = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const patches = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      body: JSON.parse(String((init as RequestInit).body)),
    }));
const manyBuyers = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    buyerSummary({ id: `b-${i}`, name: `Ana ${i}` }),
  );

describe("buyer dialog suggestions", () => {
  it("offers a buyer by an accent-insensitive part of the name and picks it with the keyboard", async () => {
    buyers = [buyerSummary({ id: "b-1", name: "Maria Sílva" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("silv");
    expect(
      await screen.findByRole("option", { name: "Maria Sílva" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(nameInput(), { key: "ArrowDown" });
    fireEvent.keyDown(nameInput(), { key: "Enter" });
    expect(nameInput()).toHaveValue("Maria Sílva");
  });

  it("picks a suggestion by click", async () => {
    buyers = [buyerSummary({ id: "b-1", name: "Maria Sílva" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("silv");
    fireEvent.click(await screen.findByRole("option", { name: "Maria Sílva" }));
    expect(nameInput()).toHaveValue("Maria Sílva");
  });

  it("shows at most 8 of 10 matching buyers", async () => {
    buyers = manyBuyers(10);
    open(available(), "reserved");
    await buyersLoaded();
    typeName("ana");
    expect(await screen.findAllByRole("option")).toHaveLength(8);
  });

  it("closes only the suggestion list on Escape and keeps the dialog open", async () => {
    buyers = manyBuyers(2);
    open(available(), "reserved");
    await buyersLoaded();
    typeName("ana");
    await screen.findAllByRole("option");
    fireEvent.keyDown(nameInput(), { key: "Escape" });
    await waitFor(() =>
      expect(nameInput()).toHaveAttribute("aria-expanded", "false"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(nameInput(), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("buyer dialog match state", () => {
  it("calls an unknown name a new buyer and offers an optional WhatsApp field", async () => {
    open(available(), "reserved");
    await buyersLoaded();
    typeName("Zeca");
    expect(screen.getByText("Novo comprador")).toBeInTheDocument();
    expect(nameInput()).toHaveAccessibleDescription("Novo comprador");
    expect(screen.getByLabelText("WhatsApp (opcional)")).toBeInTheDocument();
  });

  it("shows an existing buyer's phone read-only without a WhatsApp input", async () => {
    buyers = [buyerSummary({ name: "Ana", whatsappNumber: "5511988887777" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("ana");
    expect(screen.getByText("Comprador existente")).toBeInTheDocument();
    expect(screen.getByText("+55 11 98888-7777")).toBeInTheDocument();
    expect(screen.queryByLabelText("WhatsApp (opcional)")).toBeNull();
  });

  it("asks for the WhatsApp of an existing buyer without one", async () => {
    buyers = [buyerSummary({ name: "Ana" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("ANA");
    expect(screen.getByText("Comprador existente")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp (opcional)")).toBeInTheDocument();
  });
});

describe("buyer dialog saving", () => {
  it("links a key-matched buyer by id and sends the typed phone for a phoneless one", async () => {
    buyers = [buyerSummary({ id: "b-ana", name: "Ana" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("ana");
    fireEvent.change(screen.getByLabelText("WhatsApp (opcional)"), {
      target: { value: "+55 11 98888-7777" },
    });
    save("Marcar como reservado");
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      url: "/stores/store/listings/l-1/status",
      body: {
        availability: "reserved",
        buyer: { id: "b-ana", whatsappNumber: "+55 11 98888-7777" },
        agreedPriceCents: 8000,
        paid: false,
        notes: null,
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("sends the id of a picked suggestion, not its name", async () => {
    buyers = [buyerSummary({ id: "b-1", name: "Maria Sílva" })];
    open(available(), "reserved");
    await buyersLoaded();
    typeName("silv");
    fireEvent.click(await screen.findByRole("option", { name: "Maria Sílva" }));
    save("Marcar como reservado");
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]?.body.buyer).toEqual({ id: "b-1" });
  });

  it("cannot be cancelled while the save is running", async () => {
    let finish!: (response: Response) => void;
    const saved = new Promise<Response>((r) => (finish = r));
    patchResponse = () => saved;
    open(available(), "reserved");
    await buyersLoaded();
    typeName("Zeca");
    save("Marcar como reservado");
    expect(
      await screen.findByRole("button", { name: "Cancelar" }),
    ).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    finish(new Response(null, { status: 204 }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("creates a buyer by name when none matches", async () => {
    open(available(), "sold");
    await buyersLoaded();
    typeName("Zeca");
    save("Marcar como vendido");
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]?.body.buyer).toEqual({ name: "Zeca" });
  });

  it("still saves when the buyers list fails to load", async () => {
    buyersStatus = 500;
    open(available(), "reserved");
    await buyersLoaded();
    typeName("Zeca");
    save("Marcar como reservado");
    await waitFor(() => expect(patches()).toHaveLength(1));
  });

  it("asks for a name before saving", () => {
    open(available(), "reserved");
    save("Marcar como reservado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Informe o nome do comprador.",
    );
    expect(patches()).toHaveLength(0);
  });

  it("keeps the dialog open with its values and flags the name when the answer is 409", async () => {
    patchResponse = () =>
      problemResponse(409, "Esse comprador não existe mais.");
    open(available(), "reserved");
    await buyersLoaded();
    typeName("Zeca");
    save("Marcar como reservado");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esse comprador não existe mais.",
    );
    expect(nameInput()).toHaveValue("Zeca");
    expect(onClose).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Valor combinado (R$)"),
    ).toHaveValue("80");
  });
});

describe("buyer dialog prefill", () => {
  it("starts the agreed price at the listing price", () => {
    open(available(), "reserved");
    expect(screen.getByLabelText("Valor combinado (R$)")).toHaveValue("80");
  });

  it("starts the agreed price empty for an unpriced listing", () => {
    open(listingSummary({ priceCents: null }), "reserved");
    expect(screen.getByLabelText("Valor combinado (R$)")).toHaveValue("");
  });

  it("opens a reserved listing with its current sale", () => {
    open(
      listingSummary({
        availability: "reserved",
        sale: {
          buyer: { id: "b-ana", name: "Ana" },
          agreedPriceCents: 7000,
          paid: true,
          notes: "retira sábado",
        },
      }),
      "sold",
    );
    expect(nameInput()).toHaveValue("Ana");
    expect(screen.getByLabelText("Valor combinado (R$)")).toHaveValue("70");
    expect(screen.getByLabelText("Pago")).toBeChecked();
    expect(screen.getByLabelText("Observações")).toHaveValue("retira sábado");
  });
});
