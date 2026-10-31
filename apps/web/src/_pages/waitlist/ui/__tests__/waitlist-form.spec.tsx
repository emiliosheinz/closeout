import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import confetti from "canvas-confetti";
import { problem } from "@/test/fixtures";
import { WaitlistForm } from "../waitlist-form";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

let fetchMock: ReturnType<typeof vi.fn>;

function stubMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query === "(prefers-reduced-motion: reduce)",
  })) as unknown as typeof window.matchMedia;
}

const reply = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.mocked(confetti).mockClear();
  stubMotion(false);
  fetchMock = vi.fn().mockResolvedValue(reply(204));
  global.fetch = fetchMock as unknown as typeof fetch;
});

const nameInput = () => screen.getByLabelText("Seu nome");
const submitButton = () =>
  screen.getByRole("button", { name: "Entrar na lista" });
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const sentBody = () =>
  JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body);

function submitWhatsapp() {
  type("Seu nome", "Ana");
  type("Seu WhatsApp", "+55 11 99999-8888");
  fireEvent.click(submitButton());
}

describe("WaitlistForm", () => {
  it("opens on WhatsApp with the country code prefilled", () => {
    render(<WaitlistForm attribution={{}} />);
    expect(
      screen.getByRole("group", { name: "Como prefere receber o contato?" }),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "E-mail" })).not.toBeChecked();
    const contact = screen.getByLabelText("Seu WhatsApp") as HTMLInputElement;
    expect(contact.type).toBe("tel");
    expect(contact.value).toBe("+55 ");
    expect(nameInput().getAttribute("type")).toBeNull();
  });

  it("switches the contact input and clears its error when the choice changes", async () => {
    render(<WaitlistForm attribution={{}} />);
    type("Seu nome", "Ana");
    type("Seu WhatsApp", "11 9999");
    fireEvent.click(submitButton());
    expect(
      await screen.findByText(
        "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("E-mail"));
    const email = screen.getByLabelText("Seu e-mail") as HTMLInputElement;
    expect(email.type).toBe("email");
    expect(email.value).toBe("");
    expect(email.getAttribute("aria-invalid")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByLabelText("WhatsApp"));
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Seu WhatsApp") as HTMLInputElement).value,
      ).toBe("+55 "),
    );
  });

  it("shows the name message and sends nothing for an empty name", async () => {
    render(<WaitlistForm attribution={{}} />);
    type("Seu WhatsApp", "+55 11 99999-8888");
    fireEvent.click(submitButton());
    expect(await screen.findByText("Informe seu nome.")).toBeTruthy();
    expect(nameInput().getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed WhatsApp number in the browser", async () => {
    render(<WaitlistForm attribution={{}} />);
    type("Seu nome", "Ana");
    type("Seu WhatsApp", "11 9999");
    fireEvent.click(submitButton());
    expect(
      await screen.findByText(
        "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Seu WhatsApp").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed e-mail in the browser", async () => {
    render(<WaitlistForm attribution={{}} />);
    fireEvent.click(screen.getByLabelText("E-mail"));
    type("Seu nome", "Ana");
    type("Seu e-mail", "ana@");
    fireEvent.click(submitButton());
    expect(await screen.findByText("Informe um e-mail válido.")).toBeTruthy();
    expect(
      screen.getByLabelText("Seu e-mail").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the values as typed with the attribution and an empty honeypot", async () => {
    render(
      <WaitlistForm attribution={{ ref: "loja-x", src: "catalog-footer" }} />,
    );
    submitWhatsapp();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/waitlist");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
    expect(sentBody()).toEqual({
      name: "Ana",
      channel: "whatsapp",
      contact: "+55 11 99999-8888",
      website: "",
      ref: "loja-x",
      src: "catalog-footer",
    });
  });

  it("sends a typed e-mail untouched and leaves out absent attribution", async () => {
    render(<WaitlistForm attribution={{}} />);
    fireEvent.click(screen.getByLabelText("E-mail"));
    type("Seu nome", "Ana");
    type("Seu e-mail", "Ana@Example.com");
    fireEvent.click(submitButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody()).toEqual({
      name: "Ana",
      channel: "email",
      contact: "Ana@Example.com",
      website: "",
    });
  });

  it("carries the honeypot out of sight and sends what a bot fills in", async () => {
    const { container } = render(<WaitlistForm attribution={{}} />);
    const honeypot = container.querySelector(
      "input[name=website]",
    ) as HTMLInputElement;
    expect(honeypot.type).toBe("text");
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.getAttribute("autocomplete")).toBe("off");
    expect(honeypot.closest("[aria-hidden=true]")).not.toBeNull();
    fireEvent.change(honeypot, { target: { value: "http://spam.example" } });
    submitWhatsapp();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody().website).toBe("http://spam.example");
  });

  it("puts the consent notice directly after the submit button", () => {
    render(<WaitlistForm attribution={{}} />);
    expect(submitButton().nextElementSibling?.textContent).toBe(
      "Usamos seu nome e contato só para falar com você sobre o lançamento do closeout. Ao enviar, você concorda com isso.",
    );
  });

  it("replaces the form with a focused thank-you and one confetti burst on 204", async () => {
    render(
      <WaitlistForm
        attribution={{ ref: "loja-x" }}
        storeHref="/store/loja-x"
      />,
    );
    submitWhatsapp();
    const heading = await screen.findByRole("heading", {
      name: "Pronto, você está na lista!",
    });
    expect(screen.getByText("Vamos entrar em contato em breve.")).toBeTruthy();
    expect(screen.queryByLabelText("Seu nome")).toBeNull();
    expect(heading.parentElement).toBe(document.activeElement);
    expect(
      screen
        .getByRole("link", { name: "Voltar para a loja" })
        .getAttribute("href"),
    ).toBe("/store/loja-x");
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(1));
  });

  it("shows no back link without a store href", async () => {
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    await screen.findByRole("heading", { name: "Pronto, você está na lista!" });
    expect(
      screen.queryByRole("link", { name: "Voltar para a loja" }),
    ).toBeNull();
  });

  it("starts no confetti when the visitor prefers reduced motion", async () => {
    stubMotion(true);
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    await screen.findByRole("heading", { name: "Pronto, você está na lista!" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(confetti).not.toHaveBeenCalled();
  });

  it("marks the field a validation problem names and keeps the values", async () => {
    fetchMock.mockResolvedValue(
      reply(
        400,
        problem(400, "Informe um WhatsApp válido.", [
          { pointer: "/contact", detail: "Informe um WhatsApp válido." },
        ]),
      ),
    );
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    expect(await screen.findByText("Informe um WhatsApp válido.")).toBeTruthy();
    expect(
      screen.getByLabelText("Seu WhatsApp").getAttribute("aria-invalid"),
    ).toBe("true");
    expect((nameInput() as HTMLInputElement).value).toBe("Ana");
    expect(
      (screen.getByLabelText("Seu WhatsApp") as HTMLInputElement).value,
    ).toBe("+55 11 99999-8888");
    expect(
      (screen.getByLabelText("WhatsApp") as HTMLInputElement).checked,
    ).toBe(true);
    expect(confetti).not.toHaveBeenCalled();
  });

  it("marks the name field when the relay rejects the name", async () => {
    fetchMock.mockResolvedValue(
      reply(
        400,
        problem(400, "Informe seu nome.", [
          { pointer: "/name", detail: "Informe seu nome." },
        ]),
      ),
    );
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    expect(await screen.findByText("Informe seu nome.")).toBeTruthy();
    expect(nameInput().getAttribute("aria-invalid")).toBe("true");
  });

  it("alerts with the detail of any other problem and starts no confetti", async () => {
    fetchMock.mockResolvedValue(reply(429, problem(429, "TOO_MANY_ATTEMPTS")));
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "TOO_MANY_ATTEMPTS",
    );
    expect((nameInput() as HTMLInputElement).value).toBe("Ana");
    expect(
      (screen.getByLabelText("Seu WhatsApp") as HTMLInputElement).value,
    ).toBe("+55 11 99999-8888");
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("alerts that the connection failed and keeps the values", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sem conexão. Verifique a internet e tente de novo.",
    );
    expect((nameInput() as HTMLInputElement).value).toBe("Ana");
    expect(
      (screen.getByLabelText("Seu WhatsApp") as HTMLInputElement).value,
    ).toBe("+55 11 99999-8888");
    expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("disables the button while sending and ignores a second submit", async () => {
    let finish!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<WaitlistForm attribution={{}} />);
    submitWhatsapp();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Enviando...",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true),
    );
    fireEvent.submit(nameInput().closest("form") as HTMLFormElement);
    // Let the second submit's async validation settle before counting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(reply(204));
    await screen.findByRole("heading", { name: "Pronto, você está na lista!" });
  });
});
