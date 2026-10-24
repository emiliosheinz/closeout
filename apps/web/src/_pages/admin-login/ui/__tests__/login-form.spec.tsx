import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "../login-form";

describe("LoginForm", () => {
  it("keeps its Origin even when the page arrived with a no-referrer policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "E-mail ou senha inválidos." }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("E-mail ou senha inválidos."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          referrerPolicy: "same-origin",
        }),
      ),
    );
  });

  it("falls back to a generic message when a failed response carries none", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível entrar agora.",
    );
  });
});
