import { render, screen } from "@testing-library/react";
import { getStore } from "@/entities/listing/index.server";
import { metadata, WaitlistPage } from "../waitlist-page";

vi.mock("@/entities/listing/index.server", () => ({ getStore: vi.fn() }));

const renderPage = async (
  params: Record<string, string | string[] | undefined>,
) => render(await WaitlistPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.mocked(getStore).mockReset();
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  global.fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 204 }) as unknown as typeof fetch;
});

async function signUp() {
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("Seu nome"), {
    target: { value: "Ana" },
  });
  fireEvent.change(screen.getByLabelText("Seu WhatsApp"), {
    target: { value: "+55 11 99999-8888" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar na lista" }));
  await screen.findByRole("heading", { name: "Pronto, você está na lista!" });
}

describe("WaitlistPage", () => {
  it("declares the title and description", () => {
    expect(metadata.title).toBe("Lista de espera");
    expect(metadata.description).toBe(
      "Quer vender seus desapegos numa loja como esta? Entre na lista de espera do closeout.",
    );
  });

  it("shows the heading, the intro and the form", async () => {
    await renderPage({});
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Quer vender seus desapegos?",
    );
    expect(
      screen.getByText(
        "Deixe seu nome e um contato. Avisamos quando o closeout abrir para novas lojas.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Entrar na lista" }),
    ).toBeTruthy();
  });

  it("offers the way back to a store that exists", async () => {
    vi.mocked(getStore).mockResolvedValue({ slug: "loja-x" } as never);
    await renderPage({ ref: "loja-x", src: "landing" });
    expect(getStore).toHaveBeenCalledTimes(1);
    expect(getStore).toHaveBeenCalledWith("loja-x");
    await signUp();
    expect(
      screen
        .getByRole("link", { name: "Voltar para a loja" })
        .getAttribute("href"),
    ).toBe("/store/loja-x");
  });

  it("offers no way back to a store that does not exist", async () => {
    vi.mocked(getStore).mockResolvedValue(null as never);
    await renderPage({ ref: "loja-y" });
    await signUp();
    expect(
      screen.queryByRole("link", { name: "Voltar para a loja" }),
    ).toBeNull();
  });

  it("still renders the form when the store check throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getStore).mockRejectedValue(new Error("api down"));
    await renderPage({ ref: "loja-x" });
    expect(log).toHaveBeenCalledWith(
      "waitlist store check failed:",
      "api down",
    );
    await signUp();
    expect(
      screen.queryByRole("link", { name: "Voltar para a loja" }),
    ).toBeNull();
    log.mockRestore();
  });

  it.each([
    {},
    { ref: "Loja X" },
    { ref: ["a", "b"] },
  ])("does not check a store for %j", async (params) => {
    await renderPage(params);
    expect(getStore).not.toHaveBeenCalled();
  });
});
