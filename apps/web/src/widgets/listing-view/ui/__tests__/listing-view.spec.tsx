import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ListingDetail } from "@/entities/listing";
import { ListingView } from "../listing-view";

const base: ListingDetail = {
  slug: "mesa-abc123",
  title: "Mesa",
  priceCents: null,
  condition: "good",
  availability: "available",
  category: { slug: "moveis", name: "Móveis" },
  cover: null,
  description: "",
  attributes: [],
  images: [],
  sellers: [{ name: "Ana", avatarUrl: null, whatsappNumber: "5511988887777" }],
  canContact: true,
  publishedAt: null,
  updatedAt: "2026-10-17T12:00:00.000Z",
  related: [],
};

describe("ListingView", () => {
  beforeAll(() => {
    process.env.PUBLIC_BASE_URL = "https://loja.example";
  });

  it.each([
    [
      "nosso-desapego",
      "https://loja.example/store/nosso-desapego/items/mesa-abc123",
    ],
    ["loja-da-bia", "https://loja.example/store/loja-da-bia/items/mesa-abc123"],
  ])("links to the seller's WhatsApp with the item URL of %s", (slug, url) => {
    render(<ListingView storeSlug={slug} listing={base} />);
    const [link] = screen.getAllByTestId("whatsapp-contact");
    expect(link?.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5511988887777\?text=/,
    );
    expect(decodeURIComponent(link?.getAttribute("href") ?? "")).toContain(
      `catálogo de vocês: ${url}.`,
    );
  });

  it("shares the item URL of its store", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ListingView storeSlug="loja-da-bia" listing={base} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    });
    expect(writeText).toHaveBeenCalledWith(
      "https://loja.example/store/loja-da-bia/items/mesa-abc123",
    );
  });

  it("shows a neutral note and no link when the seller has no number", () => {
    render(
      <ListingView
        storeSlug="loja"
        listing={{
          ...base,
          canContact: false,
          sellers: [{ name: "Ana", avatarUrl: null, whatsappNumber: null }],
        }}
      />,
    );
    expect(screen.queryByTestId("whatsapp-contact")).toBeNull();
    expect(
      screen.getAllByText("Contato indisponível no momento.").length,
    ).toBeGreaterThan(0);
    expect(document.querySelector('a[href^="https://wa.me"]')).toBeNull();
  });

  it("never prints R$ 0 for a missing price and shows a placeholder without photos", () => {
    render(<ListingView storeSlug="loja" listing={base} />);
    expect(screen.getAllByText("Preço a combinar").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("R$ 0");
    expect(screen.getByTestId("photo-placeholder")).toBeInTheDocument();
  });

  it("shows the sold state without any contact action", () => {
    render(
      <ListingView
        storeSlug="loja"
        listing={{
          ...base,
          availability: "sold",
          canContact: false,
          sellers: [{ name: "Ana", avatarUrl: null, whatsappNumber: null }],
        }}
      />,
    );
    expect(
      screen.getAllByText("Este item já foi vendido.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId("whatsapp-contact")).toBeNull();
  });

  it("shows the price once and links the category to its catalog view", () => {
    render(
      <ListingView
        storeSlug="nosso-desapego"
        listing={{ ...base, priceCents: 45000 }}
      />,
    );
    expect(screen.getAllByText("R$ 450,00")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Móveis" })).toHaveAttribute(
      "href",
      "/store/nosso-desapego?categoria=moveis",
    );
  });

  it("links related items under the same store", () => {
    render(
      <ListingView
        storeSlug="loja-da-bia"
        listing={{
          ...base,
          related: [{ ...base, slug: "sofa-x9", title: "Sofá" }],
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Sofá" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia/items/sofa-x9",
    );
  });

  it("tells which photo is showing out of how many", () => {
    // jsdom has no layout engine, so it ships no ResizeObserver.
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    const image = (n: number) => ({
      sm: `/media/${n}-sm.webp`,
      lg: `/media/${n}-lg.webp`,
      og: `/media/${n}-og.jpg`,
      width: 1600,
      height: 1200,
    });
    try {
      render(
        <ListingView
          storeSlug="loja"
          listing={{ ...base, images: [image(1), image(2), image(3)] }}
        />,
      );
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it("asks which seller to message when several people sell the item", () => {
    render(
      <ListingView
        storeSlug="loja"
        listing={{
          ...base,
          sellers: [
            { name: "Ana", avatarUrl: null, whatsappNumber: "5511988887777" },
            { name: "Bia", avatarUrl: null, whatsappNumber: "5521977771234" },
          ],
        }}
      />,
    );
    expect(screen.getByText("Ana e Bia")).toBeInTheDocument();
    expect(document.querySelector('a[href^="https://wa.me"]')).toBeNull();

    const [action] = screen.getAllByRole("button", {
      name: "Chamar no WhatsApp",
    });
    if (!action) throw new Error("contact action missing");
    fireEvent.click(action);

    const dialog = screen.getByRole("dialog", {
      name: "Com quem você quer falar?",
    });
    const ana = within(dialog).getByRole("link", {
      name: "Chamar Ana no WhatsApp (abre em nova aba)",
    });
    const bia = within(dialog).getByRole("link", {
      name: "Chamar Bia no WhatsApp (abre em nova aba)",
    });
    expect(within(dialog).getAllByRole("link")).toHaveLength(2);
    expect(ana.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5511988887777\?text=/,
    );
    expect(bia.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5521977771234\?text=/,
    );
  });

  it("opens the only reachable seller directly, without asking", () => {
    render(
      <ListingView
        storeSlug="loja"
        listing={{
          ...base,
          sellers: [
            { name: "Ana", avatarUrl: null, whatsappNumber: null },
            { name: "Bia", avatarUrl: null, whatsappNumber: "5521977771234" },
          ],
        }}
      />,
    );
    const [link] = screen.getAllByTestId("whatsapp-contact");
    expect(link?.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5521977771234\?text=/,
    );
    expect(link).toHaveTextContent("Chamar Bia no WhatsApp");
  });
});
