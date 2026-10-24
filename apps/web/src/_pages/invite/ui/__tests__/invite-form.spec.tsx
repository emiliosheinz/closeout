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

  function fill(name: string, password: string) {
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: name },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: password },
    });
  }
  const submit = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );

  it("shows the name and password messages without sending a request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("  ", "curta");
    submit();

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(
      screen.getByText("A senha precisa ter pelo menos 10 caracteres."),
    ).toBeInTheDocument();
    const name = screen.getByLabelText("Seu nome");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Informe seu nome\./);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a message once the field is corrected and resubmitted", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("", "senha-longa-1");
    submit();
    await screen.findByText("Informe seu nome.");

    fill("Ana", "senha-longa-1");
    submit();

    await waitFor(() =>
      expect(screen.queryByText("Informe seu nome.")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Seu nome")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("shows API messages under their field and nowhere else", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message: [
          "Informe seu nome.",
          "A senha precisa ter pelo menos 10 caracteres.",
          "WhatsApp inválido.",
        ],
      }),
    }) as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("Ana", "senha-longa-1");
    submit();

    expect(
      await screen.findByLabelText("Seu nome"),
    ).toHaveAccessibleDescription(/Informe seu nome\./);
    expect(
      screen.getByLabelText("WhatsApp (opcional)"),
    ).toHaveAccessibleDescription(/WhatsApp inválido\./);
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(
      /A senha precisa ter pelo menos 10 caracteres\./,
    );
    expect(screen.getAllByText("Informe seu nome.")).toHaveLength(1);
    expect(screen.getAllByRole("alert")).toHaveLength(3);
  });

  it("shows other API messages inline in the form", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Convite expirado." }),
    }) as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("Ana", "senha-longa-1");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Convite expirado.",
    );
  });

  it("falls back to a generic message when a failed response carries none", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("Ana", "senha-longa-1");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível aceitar o convite agora.",
    );
  });

  it("shows the network message inline when the request cannot be sent", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("offline")) as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("Ana", "senha-longa-1");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão. Verifique a internet e tente de novo.",
    );
  });

  it("opens the admin with a full navigation and blocks a second submit", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<InviteForm token="tok" email="ana@loja.test" />);
    fill("Ana", "senha-longa-1");
    submit();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/admin"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Criando sua conta..." }),
    ).toBeDisabled();
    vi.unstubAllGlobals();
  });

  it("limits the name to 60 and the password to 200 characters", () => {
    render(<InviteForm token="tok" email="ana@loja.test" />);
    expect(screen.getByLabelText("Seu nome")).toHaveAttribute(
      "maxlength",
      "60",
    );
    expect(screen.getByLabelText("Senha")).toHaveAttribute("maxlength", "200");
  });

  it("sends one request while a submit is in flight", async () => {
    let resolve: (value: unknown) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(
      <InviteForm token="tok" email="ana@loja.test" />,
    );
    fill("Ana", "senha-longa-1");
    submit();

    const pending = await screen.findByRole("button", {
      name: "Criando sua conta...",
    });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve({ ok: false, json: async () => ({}) });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    ).toBeEnabled();
  });
});
