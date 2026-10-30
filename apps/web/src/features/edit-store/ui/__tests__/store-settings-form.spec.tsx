import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { sessionKeys } from "@/entities/session";
import { renderWithFeedback } from "@/test/feedback-harness";
import { problemResponse } from "@/test/fixtures";
import { StoreSettingsForm } from "../store-settings-form";

const store = {
  id: "store-1",
  slug: "casa-da-ana",
  name: "Casa da Ana",
  headline: "Tudo precisa sair",
  intro: "Estamos de mudança.",
  locale: "pt-BR",
  currency: "BRL",
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const apiCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1"));

function renderForm() {
  return renderWithFeedback(
    <StoreSettingsForm store={store} storeUrl="https://closeout.test/loja" />,
  );
}

const noToast = () =>
  expect(document.querySelector("[data-sonner-toast]")).toBeNull();

const nameInput = () => screen.getByLabelText("Nome da loja");
const save = () => screen.getByRole("button", { name: /Salvar loja|Salvando/ });

describe("StoreSettingsForm", () => {
  it("shows the name message and sends nothing when the name is empty", async () => {
    renderForm();

    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.click(save());

    expect(await screen.findByText("Informe o nome da loja.")).toBeVisible();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(nameInput()).toHaveAccessibleDescription("Informe o nome da loja.");
    expect(apiCalls()).toHaveLength(0);
    noToast();
  });

  it("limits the name to 80, the headline to 160 and the intro to 1200 characters", () => {
    renderForm();

    expect(nameInput()).toHaveAttribute("maxlength", "80");
    expect(screen.getByLabelText("Chamada principal")).toHaveAttribute(
      "maxlength",
      "160",
    );
    expect(screen.getByLabelText("Apresentação")).toHaveAttribute(
      "maxlength",
      "1200",
    );
  });

  it("clears the message once the name is fixed and resubmitted", async () => {
    renderForm();
    fireEvent.change(nameInput(), { target: { value: "" } });
    fireEvent.click(save());
    await screen.findByText("Informe o nome da loja.");

    fireEvent.change(nameInput(), { target: { value: "Casa nova" } });
    fireEvent.click(save());

    await waitFor(() =>
      expect(
        screen.queryByText("Informe o nome da loja."),
      ).not.toBeInTheDocument(),
    );
    expect(nameInput()).toHaveAttribute("aria-invalid", "false");
  });

  it('shows "Salvando..." and blocks a second submit while the request is pending', async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    renderForm();

    fireEvent.click(save());

    const pending = await screen.findByRole("button", { name: "Salvando..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(apiCalls()).toHaveLength(1);
    await act(async () => finish(new Response(null, { status: 204 })));
  });

  it("sends one request when the form is submitted twice while the save is pending", async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    const { container } = renderForm();
    const form = container.querySelector("form") as HTMLFormElement;

    fireEvent.submit(form);
    await screen.findByRole("button", { name: "Salvando..." });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await act(async () => {});

    expect(apiCalls()).toHaveLength(1);
    await act(async () => finish(new Response(null, { status: 204 })));
  });

  it("saves the trimmed values, toasts once and invalidates the nav name", async () => {
    const { client } = renderForm();
    client.setQueryData(sessionKeys.me(), {});

    fireEvent.change(nameInput(), { target: { value: "  Casa nova  " } });
    fireEvent.click(save());

    expect(await screen.findByText("Loja atualizada.")).toBeVisible();
    expect(screen.getAllByText("Loja atualizada.")).toHaveLength(1);
    expect(apiCalls()).toHaveLength(1);
    const [url, init] = apiCalls()[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/stores/store-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Casa nova",
      headline: store.headline,
      intro: store.intro,
    });
    await waitFor(() =>
      expect(client.getQueryState(sessionKeys.me())?.isInvalidated).toBe(true),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("toasts the API message and no success when the save fails", async () => {
    fetchMock.mockResolvedValue(
      problemResponse(500, "Não foi possível salvar agora."),
    );
    renderForm();

    fireEvent.click(save());

    expect(
      await screen.findByText("Não foi possível salvar agora."),
    ).toBeVisible();
    expect(screen.queryByText("Loja atualizada.")).not.toBeInTheDocument();
  });
});

describe("StoreSettingsForm server render", () => {
  it("carries the saved values in the HTML before hydration", () => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <StoreSettingsForm
          store={store}
          storeUrl="https://closeout.test/loja"
        />
      </QueryClientProvider>,
    );

    expect(html).toContain('value="Casa da Ana"');
    expect(html).toContain('value="Tudo precisa sair"');
    expect(html).toContain("Estamos de mudança.");
  });
});
