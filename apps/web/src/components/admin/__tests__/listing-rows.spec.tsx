import { render, screen } from "@testing-library/react";
import type { AdminListingSummary } from "@/lib/admin/types";
import { ListingRows } from "../listing-rows";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const row = (
  id: string,
  sellerIds: string[],
  publication: AdminListingSummary["publication"] = "published",
): AdminListingSummary => ({
  id,
  slug: id,
  title: `Item ${id}`,
  priceCents: 1000,
  condition: "good",
  availability: "available",
  publication,
  category: { id: "c", name: "Móveis" },
  sellers: sellerIds.map((id) => ({ id, displayName: id })),
  coverUrl: null,
  imageCount: 1,
  updatedAt: "2026-10-17T12:00:00.000Z",
});

describe("ListingRows", () => {
  it("warns on published items whose seller cannot be reached", () => {
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[
          row("a", ["no-phone"]),
          row("b", ["with-phone"]),
          row("c", ["no-phone"], "draft"),
          row("d", ["no-phone", "with-phone"]),
        ]}
        unreachableSellerIds={["no-phone"]}
      />,
    );
    const warnings = screen.getAllByRole("link", { name: /sem WhatsApp/ });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveAttribute("href", "/admin/vendedores");
    expect(warnings[0]?.closest("li")).toHaveTextContent("Item a");
  });

  it.each([
    ["nosso-desapego", "/store/nosso-desapego/items/a"],
    ["loja-da-bia", "/store/loja-da-bia/items/a"],
  ])("links published items to their page in %s", (slug, href) => {
    render(
      <ListingRows
        storeId="store"
        storeSlug={slug}
        listings={[row("a", [])]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Ver Item a na loja" }),
    ).toHaveAttribute("href", href);
  });

  it("links unpublished items to the admin preview", () => {
    render(
      <ListingRows
        storeId="store"
        storeSlug="loja"
        listings={[row("b", [], "draft")]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Pré-visualizar Item b" }),
    ).toHaveAttribute("href", "/admin/anuncios/b/previa");
  });
});
