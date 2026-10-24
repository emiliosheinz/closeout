import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InviteForm } from "../invite-form";

describe("InviteForm", () => {
  it("sends the typed WhatsApp number with the invite", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp (opcional)"), {
      target: { value: "+55 11 99999-8888" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(init.body)).toMatchObject({
      whatsappNumber: "+55 11 99999-8888",
    });
  });
});
