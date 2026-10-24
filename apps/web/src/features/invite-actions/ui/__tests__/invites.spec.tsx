import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PendingInvite } from "@/entities/invite";
import { PendingInvites } from "../invites";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const invite: PendingInvite = {
  id: "i1",
  email: "bia@example.com",
  role: "seller",
  expiresAt: "2026-11-01T12:00:00.000Z",
};

function renderInvites() {
  render(<PendingInvites storeId="store" invites={[invite]} />);
  return screen.getByRole("button", {
    name: "Ações para o convite de bia@example.com",
  });
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
});
