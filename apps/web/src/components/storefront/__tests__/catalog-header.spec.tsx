import { render, screen } from "@testing-library/react";
import type { StoreInfo } from "@/lib/catalog/types";
import { EmptyState } from "../empty-state";
import { StoreHeader } from "../store-header";

const store: StoreInfo = {
  slug: "nosso-desapego",
  name: "Nosso Desapego",
  headline: "Estamos de mudança",
  intro: "Tudo usado com carinho.",
  locale: "pt-BR",
  currency: "BRL",
  counts: { available: 3, reserved: 1, sold: 0 },
  categories: [],
  sellers: [{ name: "Ana", avatarUrl: null, whatsappNumber: "5511988887777" }],
};

describe("StoreHeader", () => {
  it("introduces the store on the plain catalog", () => {
    render(<StoreHeader store={store} />);
    expect(
      screen.getByRole("heading", { name: "Estamos de mudança" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tudo usado com carinho.")).toBeInTheDocument();
  });

  it("shrinks to the store name linking to its catalog while browsing results", () => {
    render(<StoreHeader store={store} compact />);
    expect(screen.queryByText("Estamos de mudança")).toBeNull();
    expect(screen.queryByText("Tudo usado com carinho.")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Nosso Desapego" }),
    ).toHaveAttribute("href", "/store/nosso-desapego");
  });

  it("links the compact header of another store to that store", () => {
    render(
      <StoreHeader
        store={{ ...store, slug: "loja-da-bia", name: "Loja da Bia" }}
        compact
      />,
    );
    expect(screen.getByRole("link", { name: "Loja da Bia" })).toHaveAttribute(
      "href",
      "/store/loja-da-bia",
    );
  });
});

describe("EmptyState", () => {
  it.each([
    ["nosso-desapego", "/store/nosso-desapego"],
    ["loja-da-bia", "/store/loja-da-bia"],
  ])("clears the filters back to the catalog of %s", (slug, href) => {
    render(<EmptyState storeSlug={slug} filtered />);
    expect(
      screen.getByRole("link", { name: "Ver todos os itens" }),
    ).toHaveAttribute("href", href);
  });

  it("lets a visitor ask on WhatsApp when nothing matches", () => {
    render(
      <EmptyState
        storeSlug="loja"
        filtered
        contactHref="https://wa.me/5511988887777"
      />,
    );
    expect(
      screen.getByRole("link", { name: "Perguntar no WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/5511988887777");
  });

  it("offers no WhatsApp link without a reachable seller", () => {
    render(<EmptyState storeSlug="loja" filtered />);
    expect(
      screen.queryByRole("link", { name: "Perguntar no WhatsApp" }),
    ).toBeNull();
  });
});
