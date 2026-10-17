import { fireEvent, render, screen } from "@testing-library/react";
import { ListingForm } from "../listing-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

const seller = (id: string, displayName: string) => ({
  id,
  userId: null,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 0,
});

const renderNew = () =>
  render(
    <ListingForm
      storeId="store"
      categories={[{ id: "c", slug: "moveis", name: "Móveis" }]}
      sellers={[seller("ana", "Ana"), seller("bia", "Bia")]}
      defaultSellerId="bia"
    />,
  );

describe("ListingForm", () => {
  it("asks for photos before anything else on a new listing", () => {
    renderNew();
    const photos = screen.getByLabelText("Fotos");
    const title = screen.getByLabelText("Nome do item");
    expect(
      photos.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("starts a new listing with only the signed-in seller and requires one", () => {
    renderNew();
    expect(screen.getByRole("checkbox", { name: "Ana" })).not.toBeChecked();
    const mine = screen.getByRole("checkbox", { name: "Bia" });
    expect(mine).toBeChecked();

    fireEvent.click(mine);
    fireEvent.change(screen.getByLabelText("Nome do item"), {
      target: { value: "Mesa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(
      screen.getByText(
        "Escolha ao menos uma pessoa para receber as mensagens.",
      ),
    ).toBeInTheDocument();
  });
});
