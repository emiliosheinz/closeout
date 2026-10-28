import { loginRequestSchema } from "@closeout/contracts/schemas";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { problem } from "@/test/fixtures";
import { LoginForm } from "../login-form";

describe("LoginForm", () => {
  it("keeps its Origin even when the page arrived with a no-referrer policy", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => problem(401, "E-mail ou senha inválidos."),
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha inválidos.",
    );
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

  it("sends the trimmed email in a body the login request schema takes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => problem(401, "E-mail ou senha inválidos."),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "  ana@loja.test " },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(body).toEqual({ email: "ana@loja.test", password: "senha-longa-1" });
    expect(loginRequestSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    [400, "Informe um e-mail válido e a senha."],
    [429, "Muitas tentativas. Tente novamente em alguns minutos."],
  ])("shows the %s problem's detail", async (status, detail) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => problem(status, detail),
    }) as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
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

  it("shows the email and password messages without sending a request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "sem-arroba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Informe um e-mail válido."),
    ).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Informe um e-mail válido.");
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Informe sua senha.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the network message inline when the request cannot be sent", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão. Verifique a internet e tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("opens the admin with a full navigation and blocks a second submit", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
    vi.unstubAllGlobals();
  });

  it("sends one request while a submit is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const pending = await screen.findByRole("button", { name: "Entrando..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve({ ok: false, json: async () => ({}) });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("clears the field messages once both are fixed and resubmitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => problem(401, "E-mail ou senha inválidos."),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "sem-arroba" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByText("Informe um e-mail válido.");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await screen.findByText("E-mail ou senha inválidos.");
    expect(
      screen.queryByText("Informe um e-mail válido."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Informe sua senha.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("clears the wrong-credentials message when the form is resubmitted", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => problem(401, "E-mail ou senha inválidos."),
      })
      .mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@loja.test" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    resolve({ ok: false, json: async () => ({}) });
    await screen.findByRole("alert");
  });
});
