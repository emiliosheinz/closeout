import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { inviteKeys, type PendingInvite } from "@/entities/invite";
import { renderWithFeedback } from "@/test/feedback-harness";
import { InviteButton, PendingInvites } from "../invites";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const apiCalls = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith("/api/v1"))
    .map(([url, init]) => ({
      url: String(url).replace("/api/v1", ""),
      method: (init as RequestInit).method,
      body: (init as RequestInit).body,
    }));

const invite: PendingInvite = {
  id: "i1",
  email: "bia@example.com",
  role: "seller",
  expiresAt: "2026-11-01T12:00:00.000Z",
};

const issued = {
  invite,
  link: "https://closeout.test/convite/abc",
};

function renderInvites() {
  const view = renderWithFeedback(
    <PendingInvites storeId="store" invites={[invite]} />,
  );
  const trigger = screen.getByRole("button", {
    name: "Ações para o convite de bia@example.com",
  });
  return Object.assign(trigger, { client: view.client });
}

const firstItem = () => screen.getAllByRole("menuitem")[0] as HTMLElement;

async function openMenu(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await screen.findByRole("menu");
  await waitFor(() => expect(firstItem()).toHaveFocus());
}

describe("Invite row actions menu", () => {
  it("names the trigger after the invite and lists the two actions", async () => {
    const trigger = renderInvites();
    await openMenu(trigger);

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Gerar novo link", "Revogar"]);
  });

  it("moves focus with arrows, Home and End", async () => {
    const trigger = renderInvites();
    await openMenu(trigger);
    const [regenerate, revoke] = screen.getAllByRole("menuitem") as [
      HTMLElement,
      HTMLElement,
    ];

    fireEvent.keyDown(regenerate, { key: "ArrowDown" });
    await waitFor(() => expect(revoke).toHaveFocus());
    fireEvent.keyDown(revoke, { key: "ArrowUp" });
    await waitFor(() => expect(regenerate).toHaveFocus());
    fireEvent.keyDown(regenerate, { key: "End" });
    await waitFor(() => expect(revoke).toHaveFocus());
    fireEvent.keyDown(revoke, { key: "Home" });
    await waitFor(() => expect(regenerate).toHaveFocus());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = renderInvites();
    await openMenu(trigger);

    fireEvent.keyDown(firstItem(), { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on Tab", async () => {
    const trigger = renderInvites();
    await openMenu(trigger);

    fireEvent.keyDown(firstItem(), { key: "Tab" });

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("opens the alert dialog from Revogar", async () => {
    const trigger = renderInvites();
    await openMenu(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "Revogar" }));

    expect(
      await screen.findByRole("alertdialog", {
        name: "Revogar o convite de bia@example.com?",
      }),
    ).toBeInTheDocument();
  });

  it("moves focus to the invites heading after a revocation", async () => {
    renderWithFeedback(
      <>
        <h2 id="team-invites" tabIndex={-1}>
          Convites pendentes
        </h2>
        <PendingInvites storeId="store" invites={[invite]} />
      </>,
    );
    await openMenu(
      screen.getByRole("button", {
        name: "Ações para o convite de bia@example.com",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Revogar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Revogar convite" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Convites pendentes" }),
      ).toHaveFocus(),
    );
  });

  it("toasts the error and keeps the dialog open when the revocation fails", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Não foi possível revogar agora." },
        { status: 500 },
      ),
    );
    renderWithFeedback(<PendingInvites storeId="store" invites={[invite]} />);
    await openMenu(
      screen.getByRole("button", {
        name: "Ações para o convite de bia@example.com",
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Revogar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Revogar convite" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível revogar agora.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("sends the DELETE, toasts once and refreshes the pending invites after a confirmed revocation", async () => {
    const trigger = renderInvites();
    trigger.client.setQueryData(inviteKeys.pending("store"), { items: [] });
    await openMenu(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Revogar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Revogar convite" }),
    );

    expect(await screen.findByText("Convite revogado.")).toBeVisible();
    expect(screen.getAllByText("Convite revogado.")).toHaveLength(1);
    expect(apiCalls()).toEqual([
      { url: "/stores/store/invites/i1", method: "DELETE", body: undefined },
    ]);
    await waitFor(() =>
      expect(
        trigger.client.getQueryState(inviteKeys.pending("store"))
          ?.isInvalidated,
      ).toBe(true),
    );
  });

  it("POSTs regenerate and opens the link dialog without a toast", async () => {
    fetchMock.mockResolvedValue(Response.json(issued));
    const trigger = renderInvites();
    trigger.client.setQueryData(inviteKeys.pending("store"), { items: [] });
    await openMenu(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "Gerar novo link" }));

    expect(
      await screen.findByRole("dialog", {
        name: "Convite para bia@example.com",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Link do convite")).toHaveValue(
      "https://closeout.test/convite/abc",
    );
    expect(apiCalls()).toEqual([
      {
        url: "/stores/store/invites/i1/regenerate",
        method: "POST",
        body: undefined,
      },
    ]);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
    await waitFor(() =>
      expect(
        trigger.client.getQueryState(inviteKeys.pending("store"))
          ?.isInvalidated,
      ).toBe(true),
    );
  });

  it("shows no dialog and no error toast, and refreshes the list, when regenerate returns an unreadable body", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json({}));
    const trigger = renderInvites();
    trigger.client.setQueryData(inviteKeys.pending("store"), { items: [] });
    await openMenu(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "Gerar novo link" }));

    await waitFor(() =>
      expect(
        trigger.client.getQueryState(inviteKeys.pending("store"))
          ?.isInvalidated,
      ).toBe(true),
    );
    expect(logged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("InviteButton", () => {
  async function openDialog() {
    const view = renderWithFeedback(<InviteButton storeId="store" />);
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas" }));
    await screen.findByRole("dialog", { name: "Convidar pessoas" });
    return view;
  }
  const email = () => screen.getByLabelText("E-mail da pessoa");

  it("enforces the email rule and sends nothing", async () => {
    await openDialog();

    fireEvent.change(email(), { target: { value: "bia@example" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeVisible();
    expect(email()).toHaveAttribute("aria-invalid", "true");
    expect(email()).toHaveAccessibleDescription("Informe um e-mail válido.");
    expect(apiCalls()).toHaveLength(0);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("clears the email message once the email is fixed and resubmitted", async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    await openDialog();
    fireEvent.change(email(), { target: { value: "bia@example" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));
    await screen.findByText("Informe um e-mail válido.");

    fireEvent.change(email(), { target: { value: "bia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    await waitFor(() =>
      expect(
        screen.queryByText("Informe um e-mail válido."),
      ).not.toBeInTheDocument(),
    );
    expect(email()).toHaveAttribute("aria-invalid", "false");
    await act(async () => finish(Response.json(issued)));
  });

  it("sends one request when the form is submitted twice while the invite is pending", async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    await openDialog();
    const form = email().closest("form") as HTMLFormElement;
    fireEvent.change(email(), { target: { value: "bia@example.com" } });

    fireEvent.submit(form);
    await screen.findByRole("button", { name: "Criando convite..." });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await act(async () => {});

    expect(apiCalls()).toHaveLength(1);
    await act(async () => finish(Response.json(issued)));
  });

  it('shows "Criando convite..." and blocks a second submit while pending', async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    await openDialog();
    fireEvent.change(email(), { target: { value: "bia@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    const pending = await screen.findByRole("button", {
      name: "Criando convite...",
    });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(apiCalls()).toHaveLength(1);
    await act(async () => finish(Response.json(issued)));
  });

  it("issues the invite, opens the link dialog with no toast and refreshes the pending invites", async () => {
    fetchMock.mockResolvedValue(Response.json(issued));
    const { client } = await openDialog();
    client.setQueryData(inviteKeys.pending("store"), { items: [] });

    fireEvent.change(email(), { target: { value: " bia@example.com " } });
    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    expect(
      await screen.findByRole("dialog", {
        name: "Convite para bia@example.com",
      }),
    ).toBeVisible();
    expect(apiCalls()).toHaveLength(1);
    expect(apiCalls()[0]).toMatchObject({
      url: "/stores/store/invites",
      method: "POST",
    });
    expect(JSON.parse(apiCalls()[0]?.body as string)).toEqual({
      email: "bia@example.com",
      role: "admin",
    });
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
    await waitFor(() =>
      expect(
        client.getQueryState(inviteKeys.pending("store"))?.isInvalidated,
      ).toBe(true),
    );
  });

  it("shows the API's email message under the field and no toast", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Essa pessoa já tem uma conta." },
        { status: 409 },
      ),
    );
    await openDialog();
    fireEvent.change(email(), { target: { value: "bia@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    await waitFor(() =>
      expect(email()).toHaveAccessibleDescription(
        "Essa pessoa já tem uma conta.",
      ),
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });

  it("closes without a link dialog or error toast, and refreshes the list, when issuing returns an unreadable body", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json({}));
    const { client } = await openDialog();
    client.setQueryData(inviteKeys.pending("store"), { items: [] });
    fireEvent.change(email(), { target: { value: "bia@example.com" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar convite" }));

    await waitFor(() =>
      expect(
        client.getQueryState(inviteKeys.pending("store"))?.isInvalidated,
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(logged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link do convite")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
