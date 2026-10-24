import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminListingDetail } from "@/entities/listing";
import { api } from "@/shared/api";
import { ListingForm } from "../listing-form";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/shared/api", () => ({
  ...jest.requireActual("@/shared/api"),
  api: jest.fn(),
}));

const apiMock = api as jest.MockedFunction<typeof api>;

const seller = (id: string, displayName: string) => ({
  id,
  userId: `user-${id}`,
  displayName,
  whatsappNumber: "5511988887777",
  avatarUrl: null,
  listingCount: 0,
});

const categories = [{ id: "c", slug: "moveis", name: "Móveis" }];
const sellers = [seller("ana", "Ana"), seller("bia", "Bia")];

const listing: AdminListingDetail = {
  id: "listing-1",
  slug: "mesa",
  title: "Mesa",
  priceCents: 10000,
  condition: "good",
  availability: "available",
  publication: "draft",
  category: { id: "c", name: "Móveis" },
  sellers: [
    { id: "ana", displayName: "Ana" },
    { id: "bia", displayName: "Bia" },
  ],
  coverUrl: null,
  imageCount: 0,
  updatedAt: "2026-10-17T12:00:00.000Z",
  description: "",
  attributes: [],
  images: [],
};

const renderNew = (canAssignSellers = true) =>
  render(
    <ListingForm
      storeId="store"
      categories={categories}
      sellers={sellers}
      ownSellerId="bia"
      canAssignSellers={canAssignSellers}
    />,
  );

beforeEach(() => {
  apiMock.mockReset();
});

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

  it("shows a seller their own name instead of a picker and lets the API assign them", async () => {
    apiMock.mockResolvedValue({ id: "new-listing" });
    renderNew(false);
    expect(screen.queryAllByRole("checkbox", { name: /Ana|Bia/ })).toHaveLength(
      0,
    );
    expect(screen.getByText("Bia")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do item"), {
      target: { value: "Mesa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    const [method, path, body] = apiMock.mock.calls[0] ?? [];
    expect(method).toBe("POST");
    expect(path).toBe("/stores/store/listings");
    expect(body).not.toHaveProperty("sellerIds");
  });

  it("shows a seller every assigned name on an edit and never sends the assignment", async () => {
    apiMock.mockResolvedValue({});
    render(
      <ListingForm
        storeId="store"
        categories={categories}
        sellers={sellers}
        ownSellerId="bia"
        canAssignSellers={false}
        listing={listing}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: "Ana" })).toBeNull();
    expect(screen.getByText("Ana e Bia")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    const [method, path, body] = apiMock.mock.calls[0] ?? [];
    expect(method).toBe("PATCH");
    expect(path).toBe("/stores/store/listings/listing-1");
    expect(body).not.toHaveProperty("sellerIds");
  });

  it("sends the picked sellers when a manager saves", async () => {
    apiMock.mockResolvedValue({});
    render(
      <ListingForm
        storeId="store"
        categories={categories}
        sellers={sellers}
        ownSellerId="bia"
        canAssignSellers
        listing={listing}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0]?.[2]).toMatchObject({ sellerIds: ["bia"] });
  });
});
