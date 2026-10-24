import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import { getQueryClient } from "@/shared/api";
import { InvitePage } from "../invite-page";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "179.129.216.37" }),
  cookies: async () => ({ get: () => mockCookie }),
}));

let mockCookie: { value: string } | undefined;
interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

// jsdom has no fetch Response; the page reads only these members.
const respond = (body: unknown, status = 200): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

let lookupResponse: FakeResponse;
let meResponse: FakeResponse;

beforeEach(() => {
  process.env.API_BASE_URL = "http://api:3001";
  process.env.INTERNAL_API_SECRET = "secret";
  mockCookie = undefined;
  getQueryClient().clear();
  global.fetch = vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith("/me") ? meResponse : lookupResponse,
  ) as unknown as typeof fetch;
});

const valid = () =>
  respond({
    storeName: "Nosso Desapego",
    email: "duda@loja.test",
    role: "seller",
  });

async function renderPage(token = "tok-123") {
  render(await InvitePage({ params: Promise.resolve({ token }) }));
}

const INVALID =
  "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";

describe("invite page", () => {
  it("looks the token up through the API with the internal secret and visitor IP", async () => {
    lookupResponse = valid();
    await renderPage();
    const [url, init] = (global.fetch as Mock).mock.calls[0] ?? [];
    expect(url).toBe("http://api:3001/auth/invites/lookup");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body)).toEqual({ token: "tok-123" });
    const headers = new Headers(init.headers);
    expect(headers.get("x-internal-secret")).toBe("secret");
    expect(headers.get("x-client-ip")).toBe("179.129.216.37");
  });

  it("shows a signed-out visitor the store, the invited email and the account fields", async () => {
    lookupResponse = valid();
    await renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Nosso Desapego" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Você entra como Vendedor(a)")).toBeInTheDocument();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveValue("duda@loja.test");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Seu nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByText("Pelo menos 10 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("WhatsApp (opcional)")).toBeInTheDocument();
  });

  it("treats a stale cookie the API no longer accepts as signed out", async () => {
    mockCookie = { value: "stale" };
    lookupResponse = valid();
    meResponse = respond(null, 401);
    await renderPage();
    expect(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    ).toBeInTheDocument();
  });

  it("asks a signed-in user to sign out first, without the form", async () => {
    mockCookie = { value: "live" };
    lookupResponse = valid();
    meResponse = respond({
      user: { id: "u", name: "Ana", email: "ana@loja.test" },
      memberships: [],
    });
    await renderPage();
    expect(
      screen.getByText(
        "Você está conectado como ana@loja.test. Saia para aceitar este convite.",
      ),
    ).toBeInTheDocument();
    // A failing sign-out keeps the page (jsdom cannot reload it).
    (global.fetch as Mock).mockReset().mockResolvedValue(respond(null, 500));
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(
      await screen.findByText("Não foi possível sair agora. Tente de novo."),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      referrerPolicy: "same-origin",
    });
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("renders every invalid link the same, revealing nothing", async () => {
    lookupResponse = respond({ message: INVALID }, 404);
    await renderPage("unknown");
    const notFound = document.body.innerHTML;
    document.body.innerHTML = "";

    lookupResponse = respond({ message: ["token must be a string"] }, 400);
    await renderPage("unknown");
    expect(document.body.innerHTML).toBe(notFound);
    expect(screen.getByText(INVALID)).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: "Já tenho conta: entrar" });
    expect(signIn).toHaveAttribute("href", "/admin/entrar");
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("tells a rate-limited visitor to wait", async () => {
    lookupResponse = respond({ message: "x" }, 429);
    await renderPage();
    expect(
      screen.getByText("Muitas tentativas. Tente novamente em alguns minutos."),
    ).toBeInTheDocument();
  });

  it("checks the name and password before creating the account", async () => {
    lookupResponse = valid();
    await renderPage();
    (global.fetch as Mock).mockClear();
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: "  " },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "123456789" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    expect(
      screen.getByText("A senha precisa ter pelo menos 10 caracteres."),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the API's WhatsApp error on its field", async () => {
    lookupResponse = valid();
    await renderPage();
    const whatsapp =
      "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";
    (global.fetch as Mock).mockResolvedValue(
      respond({ message: [whatsapp] }, 400),
    );
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: "Duda" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.change(screen.getByLabelText("WhatsApp (opcional)"), {
      target: { value: "123" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("WhatsApp (opcional)")).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(screen.getByText(whatsapp)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/invite",
      // A no-referrer page would otherwise send `Origin: null`.
      expect.objectContaining({
        method: "POST",
        referrerPolicy: "same-origin",
      }),
    );
  });

  it("shows the API's message when the invited email already has an account", async () => {
    lookupResponse = valid();
    await renderPage();
    (global.fetch as Mock).mockResolvedValue(
      respond({ message: "Este e-mail já tem uma conta." }, 409),
    );
    fireEvent.change(screen.getByLabelText("Seu nome"), {
      target: { value: "Duda" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-longa-1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Criar conta e entrar" }),
    );
    expect(
      await screen.findByText("Este e-mail já tem uma conta."),
    ).toBeInTheDocument();
  });
});
