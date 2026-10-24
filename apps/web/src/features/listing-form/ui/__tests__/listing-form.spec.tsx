import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MockedFunction } from "vitest";
import type { AdminListingDetail } from "@/entities/listing";
import { api } from "@/shared/api";
import { ListingForm } from "../listing-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/shared/api", async () => ({
  ...(await vi.importActual("@/shared/api")),
  api: vi.fn(),
}));

const apiMock = api as MockedFunction<typeof api>;

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
  push.mockReset();
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

  describe("save outcomes", () => {
    const renderEdit = (publication: AdminListingDetail["publication"]) =>
      render(
        <ListingForm
          storeId="store"
          categories={categories}
          sellers={sellers}
          ownSellerId="bia"
          canAssignSellers
          listing={{ ...listing, publication }}
        />,
      );

    it("publishes a draft being edited and lands on its page with the published notice", async () => {
      apiMock.mockResolvedValue({});
      renderEdit("draft");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar e publicar" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/listing-1?salvo=publicado",
        ),
      );
      expect(apiMock.mock.calls[0]?.[2]).toMatchObject({
        publication: "published",
      });
    });

    it("keeps an archived listing archived on a plain save", async () => {
      apiMock.mockResolvedValue({});
      renderEdit("archived");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/admin/anuncios/listing-1?salvo=1"),
      );
      expect(apiMock.mock.calls[0]?.[2]).toMatchObject({
        publication: "archived",
      });
    });

    it("keeps a draft a draft on a plain save", async () => {
      apiMock.mockResolvedValue({});
      renderEdit("draft");
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar alterações" }),
      );

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith("/admin/anuncios/listing-1?salvo=1"),
      );
      expect(apiMock.mock.calls[0]?.[2]).toMatchObject({
        publication: "draft",
      });
    });

    it("saves a new listing as a draft and opens it with the plain saved notice", async () => {
      apiMock.mockResolvedValue({ id: "new-listing" });
      renderNew();
      fireEvent.change(screen.getByLabelText("Nome do item"), {
        target: { value: "Mesa" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));

      await waitFor(() =>
        expect(push).toHaveBeenCalledWith(
          "/admin/anuncios/new-listing?salvo=1",
        ),
      );
      expect(apiMock).toHaveBeenCalledTimes(1);
    });

    it("publishes a new listing after its photos and opens it with the published notice", async () => {
      apiMock.mockResolvedValue({ id: "new-listing", items: [] });
      const createObjectURL = vi.fn(() => "blob:preview");
      const original = {
        create: URL.createObjectURL,
        revoke: URL.revokeObjectURL,
      };
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = vi.fn();
      try {
        renderNew();
        fireEvent.change(screen.getByLabelText("Fotos"), {
          target: {
            files: [new File(["x"], "mesa.jpg", { type: "image/jpeg" })],
          },
        });
        fireEvent.change(screen.getByLabelText("Nome do item"), {
          target: { value: "Mesa" },
        });
        fireEvent.click(
          screen.getByRole("button", { name: "Salvar e publicar" }),
        );

        await waitFor(() =>
          expect(push).toHaveBeenCalledWith(
            "/admin/anuncios/new-listing?salvo=publicado",
          ),
        );
        expect(apiMock).toHaveBeenLastCalledWith(
          "PATCH",
          "/stores/store/listings/new-listing/status",
          { publication: "published" },
        );
      } finally {
        URL.createObjectURL = original.create;
        URL.revokeObjectURL = original.revoke;
      }
    });
  });

  describe("photo previews", () => {
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    const original = {
      createObjectURL: URL.createObjectURL,
      revokeObjectURL: URL.revokeObjectURL,
    };

    beforeEach(() => {
      let next = 0;
      createObjectURL.mockImplementation(() => `blob:preview-${++next}`);
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
      URL.createObjectURL = original.createObjectURL;
      URL.revokeObjectURL = original.revokeObjectURL;
    });

    const addPhoto = () =>
      fireEvent.change(screen.getByLabelText("Fotos"), {
        target: {
          files: [new File(["x"], "mesa.jpg", { type: "image/jpeg" })],
        },
      });

    it("keeps one preview URL for a photo while the rest of the form changes", () => {
      renderNew();
      addPhoto();
      fireEvent.change(screen.getByLabelText("Nome do item"), {
        target: { value: "Mesa de jantar" },
      });
      fireEvent.change(screen.getByLabelText("Nome do item"), {
        target: { value: "Mesa de jantar grande" },
      });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it("revokes a preview URL when its photo is removed", () => {
      renderNew();
      addPhoto();
      fireEvent.click(screen.getByRole("button", { name: "Remover foto 1" }));

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });

    it("revokes the preview URLs when the form goes away", () => {
      const { unmount } = renderNew();
      addPhoto();
      unmount();

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    });
  });
});
