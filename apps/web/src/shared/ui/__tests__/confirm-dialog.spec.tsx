import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import oracle from "@/test/copy-oracle.json";
import { ConfirmDialog } from "../confirm-dialog";

const copy = oracle.revokeInvite;

function setup(onConfirm: () => Promise<void>, onSuccess = vi.fn()) {
  render(
    <ConfirmDialog
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      pendingLabel={copy.pendingLabel}
      onConfirm={onConfirm}
      onSuccess={onSuccess}
      trigger={(open) => (
        <button type="button" onClick={open}>
          Abrir
        </button>
      )}
    />,
  );
  return { onSuccess };
}

describe("ConfirmDialog", () => {
  it("opens an alert dialog with the copy and focus on cancel", async () => {
    setup(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = await screen.findByRole("alertdialog", {
      name: copy.title,
    });
    expect(dialog).toHaveAccessibleDescription(copy.description);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(
      screen.getByRole("button", { name: copy.confirmLabel }),
    ).toBeInTheDocument();
  });

  it("shows the pending label while the action runs", async () => {
    let finish: () => void = () => undefined;
    setup(() => new Promise<void>((resolve) => (finish = resolve)));
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.confirmLabel }),
    );

    expect(
      await screen.findByRole("button", { name: copy.pendingLabel }),
    ).toBeDisabled();
    finish();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("stays open and shows the error when the action fails", async () => {
    const { onSuccess } = setup(async () => {
      throw new Error("Falhou no servidor.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.confirmLabel }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falhou no servidor.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.confirmLabel }),
    ).toBeEnabled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("closes and calls the focus-target callback on success", async () => {
    const { onSuccess } = setup(async () => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.confirmLabel }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not call the callback when cancelled", async () => {
    const { onSuccess } = setup(async () => undefined);
    const opener = screen.getByRole("button", { name: "Abrir" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("clears the error as soon as the action is retried", async () => {
    let attempt = 0;
    let finish: () => void = () => undefined;
    setup(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new Error("Falhou."));
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.confirmLabel }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Falhou.");

    fireEvent.click(screen.getByRole("button", { name: copy.confirmLabel }));

    await screen.findByRole("button", { name: copy.pendingLabel });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finish();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("falls back to a generic message when the failure carries none", async () => {
    setup(() => Promise.reject("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(
      await screen.findByRole("button", { name: copy.confirmLabel }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Algo deu errado.",
    );
  });
});
