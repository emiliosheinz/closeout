import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithFeedback } from "@/test/feedback-harness";
import { buyerSummary, problemResponse } from "@/test/fixtures";
import { BuyerActions } from "../buyer-row-actions";

const ana = buyerSummary({
  id: "b-ana",
  name: "Ana",
  whatsappNumber: "5511911112222",
});
const bruno = buyerSummary({ id: "b-bruno", name: "Bruno" });

let fetchMock: ReturnType<typeof vi.fn>;
let writeResponse: () => Response;
beforeEach(() => {
  writeResponse = () => new Response(null, { status: 204 });
  fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) =>
    init.method === "GET"
      ? Response.json({ items: [ana, bruno] })
      : writeResponse(),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const writes = () =>
  fetchMock.mock.calls
    .filter(
      ([url, init]) =>
        String(url).startsWith("/api/v1") &&
        (init as RequestInit)?.method !== "GET",
    )
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      method: (init as RequestInit).method,
      body: (init as RequestInit).body,
    }));

async function openAction(
  buyer: ReturnType<typeof buyerSummary>,
  name: string,
) {
  renderWithFeedback(
    <>
      <h2 tabIndex={-1}>Lista de compradores</h2>
      <table>
        <tbody>
          <tr>
            <td>
              <BuyerActions
                storeId="store"
                buyer={buyer}
                onGone={() => screen.getByRole("heading").focus()}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </>,
  );
  const trigger = screen.getByRole("button", {
    name: `Ações para ${buyer.name}`,
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("menuitem", { name }));
}

describe("BuyerActions", () => {
  it("saves the new name and phone", async () => {
    await openAction(ana, "Editar");
    fireEvent.change(screen.getByLabelText("Nome do comprador"), {
      target: { value: "Ana Lima" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "+55 21 93333-4444" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual({
      url: "/stores/store/buyers/b-ana",
      method: "PATCH",
      body: JSON.stringify({
        name: "Ana Lima",
        whatsappNumber: "+55 21 93333-4444",
      }),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("clears the phone when the field is emptied", async () => {
    await openAction(ana, "Editar");
    fireEvent.change(screen.getByLabelText("WhatsApp"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]?.body).toBe(
      JSON.stringify({ name: "Ana", whatsappNumber: "" }),
    );
  });

  it("shows the refusal of a taken name and offers to merge", async () => {
    writeResponse = () =>
      problemResponse(409, "Já existe um comprador com esse nome.");
    await openAction(ana, "Editar");
    fireEvent.change(screen.getByLabelText("Nome do comprador"), {
      target: { value: "Bruno" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Já existe um comprador com esse nome."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Juntar com..." }));
    expect(
      await screen.findByRole("combobox", { name: "Juntar com" }),
    ).toBeInTheDocument();
  });

  it("explains a buyer with items cannot be deleted, offers a merge and sends nothing", async () => {
    await openAction(
      buyerSummary({ id: "b-ana", name: "Ana", linkedCount: 2, items: [] }),
      "Excluir",
    );

    expect(
      await screen.findByText(/Ana tem 2 itens e não pode ser excluído/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
    expect(screen.getByRole("button", { name: "Juntar com..." })).toBeVisible();
    expect(writes()).toEqual([]);
  });

  it("deletes a buyer with no items", async () => {
    await openAction(ana, "Excluir");
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({
      url: "/stores/store/buyers/b-ana",
      method: "DELETE",
    });
  });

  it("moves focus to the list heading after a delete", async () => {
    await openAction(ana, "Excluir");
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Lista de compradores" }),
      ).toHaveFocus(),
    );
  });

  it("offers a merge when the delete is refused because the buyer got linked", async () => {
    writeResponse = () => problemResponse(409, "Comprador com itens.");
    await openAction(ana, "Excluir");
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    expect(
      await screen.findByRole("button", { name: "Juntar com..." }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });
});
