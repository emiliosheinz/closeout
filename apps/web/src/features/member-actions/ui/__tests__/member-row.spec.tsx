import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { listingKeys } from "@/entities/listing";
import { memberKeys, type TeamMember } from "@/entities/member";
import { renderWithFeedback } from "@/test/feedback-harness";
import { MemberRow } from "../member-row";

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

const member: TeamMember = {
  userId: "u1",
  name: "Ana Souza",
  email: "ana@example.com",
  role: "seller",
  sellerId: "s1",
  displayName: "Ana",
  whatsappNumber: "5511999998888",
  avatarUrl: null,
  listingCount: 0,
};

function renderRow(overrides: {
  isSelf?: boolean;
  canManageTeam?: boolean;
  role?: TeamMember["role"];
}) {
  const view = renderWithFeedback(
    <ul>
      <MemberRow
        storeId="store"
        member={{ ...member, role: overrides.role ?? member.role }}
        isSelf={overrides.isSelf ?? false}
        canManageTeam={overrides.canManageTeam ?? true}
      />
    </ul>,
  );
  const trigger = screen.getByRole("button", { name: "Ações para Ana" });
  return Object.assign(trigger, { client: view.client });
}

const firstItem = () => screen.getAllByRole("menuitem")[0] as HTMLElement;

async function openMenu(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await screen.findByRole("menu");
  await waitFor(() => expect(firstItem()).toHaveFocus());
}

describe("MemberRow actions menu", () => {
  it("names the trigger after the member and lists Editar and Remover", async () => {
    const trigger = renderRow({});
    await openMenu(trigger);

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Editar", "Remover"]);
  });

  it("offers only Editar when the viewer cannot manage the member", async () => {
    const trigger = renderRow({ canManageTeam: false });
    await openMenu(trigger);

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Editar"]);
  });

  it("moves focus with arrows, Home and End", async () => {
    const trigger = renderRow({});
    await openMenu(trigger);
    const [edit, remove] = screen.getAllByRole("menuitem") as [
      HTMLElement,
      HTMLElement,
    ];

    fireEvent.keyDown(edit, { key: "ArrowDown" });
    await waitFor(() => expect(remove).toHaveFocus());
    fireEvent.keyDown(remove, { key: "ArrowUp" });
    await waitFor(() => expect(edit).toHaveFocus());
    fireEvent.keyDown(edit, { key: "End" });
    await waitFor(() => expect(remove).toHaveFocus());
    fireEvent.keyDown(remove, { key: "Home" });
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = renderRow({});
    await openMenu(trigger);

    fireEvent.keyDown(firstItem(), { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on Tab", async () => {
    const trigger = renderRow({});
    await openMenu(trigger);

    fireEvent.keyDown(firstItem(), { key: "Tab" });

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("opens the alert dialog from Remover and gives focus back to the trigger on cancel", async () => {
    const trigger = renderRow({});
    await openMenu(trigger);

    fireEvent.click(screen.getByRole("menuitem", { name: "Remover" }));
    await screen.findByRole("alertdialog", {
      name: "Remover Ana da equipe?",
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("moves focus to the members heading after a removal", async () => {
    renderWithFeedback(
      <>
        <h2 id="team-members" tabIndex={-1}>
          Pessoas
        </h2>
        <ul>
          <MemberRow
            storeId="store"
            member={member}
            isSelf={false}
            canManageTeam
          />
        </ul>
      </>,
    );
    await openMenu(screen.getByRole("button", { name: "Ações para Ana" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remover da equipe" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Pessoas" })).toHaveFocus(),
    );
  });

  it("toasts the error and keeps the dialog open when the removal fails", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Não foi possível remover agora." },
        { status: 500 },
      ),
    );
    renderWithFeedback(
      <ul>
        <MemberRow
          storeId="store"
          member={member}
          isSelf={false}
          canManageTeam
        />
      </ul>,
    );
    await openMenu(screen.getByRole("button", { name: "Ações para Ana" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remover da equipe" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível remover agora.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("offers a manager no Remover on the owner row", async () => {
    const owner = renderRow({ role: "owner" });
    await openMenu(owner);
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Editar"]);
  });

  it("sends the DELETE, toasts once and refreshes the team after a confirmed removal", async () => {
    const trigger = renderRow({});
    trigger.client.setQueryData(memberKeys.list("store"), { items: [] });
    trigger.client.setQueryData(listingKeys.all("store"), []);
    await openMenu(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remover" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remover da equipe" }),
    );

    expect(await screen.findByText("Ana saiu da equipe.")).toBeVisible();
    expect(screen.getAllByText("Ana saiu da equipe.")).toHaveLength(1);
    expect(apiCalls()).toEqual([
      { url: "/stores/store/members/u1", method: "DELETE", body: undefined },
    ]);
    await waitFor(() => {
      expect(
        trigger.client.getQueryState(memberKeys.list("store"))?.isInvalidated,
      ).toBe(true);
      expect(
        trigger.client.getQueryState(listingKeys.all("store"))?.isInvalidated,
      ).toBe(true);
    });
  });
});

async function openEditDialog(role: TeamMember["role"] = "seller") {
  const trigger = renderRow({ role });
  await openMenu(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
  await screen.findByRole("dialog", { name: "Ana" });
  return trigger;
}

describe("Member edit dialog", () => {
  it("opens from Editar with the member's current values", async () => {
    await openEditDialog();

    expect(screen.getByLabelText("Nome na loja")).toHaveValue("Ana");
    expect(screen.getByLabelText("WhatsApp")).toHaveValue("+5511999998888");
  });

  it("requires a name and sends nothing without one", async () => {
    await openEditDialog();

    fireEvent.change(screen.getByLabelText("Nome na loja"), {
      target: { value: "  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Informe o nome.")).toBeVisible();
    expect(screen.getByLabelText("Nome na loja")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Nome na loja")).toHaveAccessibleDescription(
      "Informe o nome.",
    );
    expect(apiCalls()).toHaveLength(0);
  });

  it('shows "Salvando..." and blocks a second submit while pending', async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    await openEditDialog();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    const pending = await screen.findByRole("button", { name: "Salvando..." });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(apiCalls()).toHaveLength(1);
    await act(async () => finish(new Response(null, { status: 204 })));
  });

  it("saves, toasts once, closes and refreshes the team", async () => {
    const trigger = await openEditDialog();
    trigger.client.setQueryData(memberKeys.list("store"), { items: [] });
    trigger.client.setQueryData(listingKeys.all("store"), []);

    fireEvent.change(screen.getByLabelText("Nome na loja"), {
      target: { value: "Aninha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Alterações salvas.")).toBeVisible();
    expect(screen.getAllByText("Alterações salvas.")).toHaveLength(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(apiCalls()).toHaveLength(1);
    expect(apiCalls()[0]).toMatchObject({
      url: "/stores/store/sellers/s1",
      method: "PATCH",
    });
    expect(JSON.parse(apiCalls()[0]?.body as string)).toEqual({
      displayName: "Aninha",
      whatsappNumber: "+5511999998888",
    });
    await waitFor(() => {
      expect(
        trigger.client.getQueryState(memberKeys.list("store"))?.isInvalidated,
      ).toBe(true);
      expect(
        trigger.client.getQueryState(listingKeys.all("store"))?.isInvalidated,
      ).toBe(true);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("also changes the role when a manager picks another one", async () => {
    await openEditDialog();

    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(apiCalls()).toHaveLength(2));
    expect(apiCalls()[1]).toMatchObject({
      url: "/stores/store/members/u1",
      method: "PATCH",
    });
    expect(JSON.parse(apiCalls()[1]?.body as string)).toEqual({
      role: "admin",
    });
  });

  it("shows the API's number message under the field, with no toast", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "Informe o WhatsApp com código do país." },
        { status: 400 },
      ),
    );
    await openEditDialog();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByLabelText("WhatsApp"),
    ).toHaveAccessibleDescription("Informe o WhatsApp com código do país.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("uploads the avatar and toasts once", async () => {
    const trigger = await openEditDialog();
    trigger.client.setQueryData(memberKeys.list("store"), { items: [] });
    trigger.client.setQueryData(listingKeys.all("store"), []);
    const file = new File(["x"], "foto.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText(/Adicionar foto/), {
      target: { files: [file] },
    });

    expect(await screen.findByText("Foto atualizada.")).toBeVisible();
    expect(screen.getAllByText("Foto atualizada.")).toHaveLength(1);
    expect(apiCalls()).toHaveLength(1);
    expect(apiCalls()[0]).toMatchObject({
      url: "/stores/store/sellers/s1/avatar",
      method: "POST",
    });
    expect((apiCalls()[0]?.body as FormData).get("file")).toBe(file);
    await waitFor(() => {
      expect(
        trigger.client.getQueryState(memberKeys.list("store"))?.isInvalidated,
      ).toBe(true);
      expect(
        trigger.client.getQueryState(listingKeys.all("store"))?.isInvalidated,
      ).toBe(true);
    });
  });

  it("toasts one error when the avatar upload fails", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ message: "Envie uma imagem válida." }, { status: 400 }),
    );
    await openEditDialog();

    fireEvent.change(screen.getByLabelText(/Adicionar foto/), {
      target: {
        files: [new File(["x"], "foto.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Envie uma imagem válida.")).toBeVisible();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("Foto atualizada.")).not.toBeInTheDocument();
  });

  it("toasts one error and shows no field error when the role change fails after the profile saved", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(
          { message: "Não foi possível mudar o papel." },
          { status: 500 },
        ),
      );
    await openEditDialog();

    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(
      await screen.findByText("Não foi possível mudar o papel."),
    ).toBeVisible();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByLabelText("WhatsApp")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not map a 400 on the role change onto the WhatsApp field", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json({ message: "Papel inválido." }, { status: 400 }),
      );
    await openEditDialog();

    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByText("Papel inválido.")).toBeVisible();
    expect(screen.getByLabelText("WhatsApp")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
