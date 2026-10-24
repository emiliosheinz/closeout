import { act, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ApiError } from "@/shared/api";
import { notify, notifyFailure, Toaster } from "../sonner";

describe("Toaster", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Toaster />);
  });
  afterEach(async () => {
    toast.dismiss();
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(toast.getToasts()).toHaveLength(0));
    vi.useRealTimers();
  });

  it("announces a success toast politely", async () => {
    act(() => void notify.success("Loja atualizada."));
    const text = await screen.findByText("Loja atualizada.");
    expect(text.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("announces an error toast assertively", async () => {
    act(() => void notify.error("Sem conexão."));
    const text = await screen.findByText("Sem conexão.");
    expect(text.closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "assertive",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Sem conexão.");
  });

  it("can be dismissed", async () => {
    act(() => void notify.success("Foto removida."));
    await screen.findByText("Foto removida.");
    expect(
      screen.getByRole("button", { name: "Fechar notificação" }),
    ).toBeInTheDocument();
  });

  it("hides on its own after about five seconds", async () => {
    act(() => void notify.success("Ordem atualizada."));
    await screen.findByText("Ordem atualizada.");

    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(screen.getByText("Ordem atualizada.")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.queryByText("Ordem atualizada.")).not.toBeInTheDocument();
  });

  it("toasts an API error's message and rethrows it", async () => {
    const error = new ApiError(409, "Este e-mail já está na equipe.");
    expect(() => notifyFailure(error)).toThrow(error);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já está na equipe.",
    );
  });

  it("shows the generic copy for a failure that is not an ApiError", async () => {
    notify.failure(new TypeError("boom"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar. Tente de novo.",
    );
  });
});
