import { render, screen } from "@testing-library/react";
import type { ListingDetail } from "@/lib/catalog/types";
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
  seller: { name: "Ana", avatarUrl: null, whatsappNumber: "5511988887777" },
  canContact: true,
  publishedAt: null,
  updatedAt: "2026-10-17T12:00:00.000Z",
  related: [],
};

describe("ListingView", () => {
  beforeAll(() => {
    process.env.PUBLIC_BASE_URL = "https://loja.example";
  });

  it("links to the seller's WhatsApp with the item URL", () => {
    render(<ListingView listing={base} />);
    const [link] = screen.getAllByTestId("whatsapp-contact");
    expect(link?.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5511988887777\?text=/,
    );
    expect(decodeURIComponent(link?.getAttribute("href") ?? "")).toContain(
      "https://loja.example/itens/mesa-abc123",
    );
  });

  it("shows a neutral note and no link when the seller has no number", () => {
    render(
      <ListingView
        listing={{
          ...base,
          canContact: false,
          seller: { ...base.seller, whatsappNumber: null },
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
    render(<ListingView listing={base} />);
    expect(screen.getAllByText("Preço a combinar").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("R$ 0");
    expect(screen.getByTestId("photo-placeholder")).toBeInTheDocument();
  });

  it("shows the sold state without any contact action", () => {
    render(
      <ListingView
        listing={{
          ...base,
          availability: "sold",
          canContact: false,
          seller: { ...base.seller, whatsappNumber: null },
        }}
      />,
    );
    expect(
      screen.getAllByText("Este item já foi vendido.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId("whatsapp-contact")).toBeNull();
  });

  it("shows the price once and links the category to its catalog view", () => {
    render(<ListingView listing={{ ...base, priceCents: 45000 }} />);
    expect(screen.getAllByText("R$ 450,00")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Móveis" })).toHaveAttribute(
      "href",
      "/?categoria=moveis",
    );
  });

  it("tells which photo is showing out of how many", () => {
    // jsdom has no layout engine, so it ships no ResizeObserver.
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
    render(
      <ListingView
        listing={{ ...base, images: [image(1), image(2), image(3)] }}
      />,
    );
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});
