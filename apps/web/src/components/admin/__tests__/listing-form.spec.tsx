import { render, screen } from "@testing-library/react";
import { ListingForm } from "../listing-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

describe("ListingForm", () => {
  it("asks for photos before anything else on a new listing", () => {
    render(
      <ListingForm
        storeId="store"
        categories={[{ id: "c", slug: "moveis", name: "Móveis" }]}
        sellers={[
          {
            id: "s",
            userId: null,
            displayName: "Ana",
            whatsappNumber: "5511988887777",
            avatarUrl: null,
            listingCount: 0,
          },
        ]}
        defaultSellerId="s"
      />,
    );
    const photos = screen.getByLabelText("Fotos");
    const title = screen.getByLabelText("Nome do item");
    expect(
      photos.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
