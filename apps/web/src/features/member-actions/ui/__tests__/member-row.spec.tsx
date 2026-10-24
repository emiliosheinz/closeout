import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TeamMember } from "@/entities/member";
import { ApiError, api } from "@/shared/api";
import { renderWithFeedback } from "@/test/feedback-harness";
import { MemberRow } from "../member-row";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/shared/api", async () => ({
  ...(await vi.importActual("@/shared/api")),
  api: vi.fn(),
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

function renderRow(overrides: { isSelf?: boolean; canManageTeam?: boolean }) {
  render(
    <ul>
      <MemberRow
        storeId="store"
        member={member}
        isSelf={overrides.isSelf ?? false}
        canManageTeam={overrides.canManageTeam ?? true}
      />
    </ul>,
  );
  return screen.getByRole("button", { name: "Ações para Ana" });
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
    vi.mocked(api).mockResolvedValue(undefined);
    render(
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
    vi.mocked(api).mockRejectedValue(new ApiError(500, "Falhou no servidor."));
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
      "Falhou no servidor.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
