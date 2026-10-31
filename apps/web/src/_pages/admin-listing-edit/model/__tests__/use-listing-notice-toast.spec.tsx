import { act, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { toast } from "sonner";
import { renderWithFeedback } from "@/test/feedback-harness";
import { ListingNoticeToast } from "../../ui/listing-notice-toast";

const nav = vi.hoisted(() => ({
  query: "",
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
  usePathname: () => "/admin/listings/abc",
  useRouter: () => ({ replace: nav.replace }),
}));

const mount = (query: string) => {
  nav.query = query;
  nav.replace.mockClear();
  return renderWithFeedback(
    <StrictMode>
      <ListingNoticeToast />
    </StrictMode>,
  );
};

describe("listing notice toast", () => {
  it.each([
    ["salvo=1", "Alterações salvas."],
    ["salvo=publicado", "Anúncio publicado. Já aparece na loja."],
    [
      "copiado=1",
      "Cópia criada como rascunho. Ajuste o que mudou e adicione as fotos.",
    ],
    [
      "erro=envio",
      "O anúncio foi salvo, mas o envio das fotos ou a publicação falhou. Confira as fotos abaixo e tente de novo.",
    ],
  ])("shows %s once and clears it", async (query, message) => {
    mount(query);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(toast.getToasts()).toHaveLength(1);
    expect(nav.replace).toHaveBeenCalledWith("/admin/listings/abc", {
      scroll: false,
    });
  });

  it("keeps one toast when the page rerenders while the notice is still in the URL", async () => {
    const { rerender } = mount("salvo=1");
    await screen.findByText("Alterações salvas.");

    // Each render reads a new search params object, which reruns the effect.
    for (let pass = 0; pass < 3; pass += 1) {
      rerender(
        <StrictMode>
          <ListingNoticeToast />
        </StrictMode>,
      );
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(toast.getToasts()).toHaveLength(1);
  });

  it("keeps unrelated params when clearing", async () => {
    mount("salvo=1&aba=fotos");
    await screen.findByText("Alterações salvas.");
    expect(nav.replace).toHaveBeenCalledWith("/admin/listings/abc?aba=fotos", {
      scroll: false,
    });
  });

  it("does nothing without a notice", () => {
    mount("");
    expect(toast.getToasts()).toHaveLength(0);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
