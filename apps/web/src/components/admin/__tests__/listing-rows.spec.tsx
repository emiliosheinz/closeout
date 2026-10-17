import { render, screen } from "@testing-library/react";
import type { AdminListingSummary } from "@/lib/admin/types";
import { ListingRows } from "../listing-rows";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const row = (
  id: string,
  sellerId: string,
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
  seller: { id: sellerId, displayName: sellerId },
  coverUrl: null,
  imageCount: 1,
  updatedAt: "2026-10-17T12:00:00.000Z",
});

describe("ListingRows", () => {
  it("warns on published items whose seller cannot be reached", () => {
    render(
      <ListingRows
        storeId="store"
        listings={[
          row("a", "no-phone"),
          row("b", "with-phone"),
          row("c", "no-phone", "draft"),
        ]}
        unreachableSellerIds={["no-phone"]}
      />,
    );
    const warnings = screen.getAllByRole("link", { name: /sem WhatsApp/ });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveAttribute("href", "/admin/vendedores");
    expect(warnings[0]?.closest("li")).toHaveTextContent("Item a");
  });
});
