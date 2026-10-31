import { screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import {
  category,
  LISTING_ID,
  listingDetail,
  meResponse,
  seller,
} from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { EditListingPage } from "../admin-listing-edit-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const props = {
  params: Promise.resolve({ id: LISTING_ID }),
};

const api = (detail: unknown) => ({
  "/me": meResponse("owner"),
  [`/stores/store-1/listings/${LISTING_ID}`]: detail,
  "/stores/store-1/categories": { items: [category] },
  "/stores/store-1/sellers": { items: [seller("s-ana", "Ana")] },
});

describe("edit listing page", () => {
  it("renders the listing's title from the first load", async () => {
    stubAdminApi(api(listingDetail({ title: "Sofá azul" })));
    renderPage(await EditListingPage(props));
    expect(
      screen.getByRole("heading", { level: 1, name: "Sofá azul" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do item")).toHaveValue("Sofá azul");
  });

  it("shows not-found when the listing does not exist", async () => {
    stubAdminApi(api(404));
    await expect(EditListingPage(props)).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it.each([
    ["listing", { [`/stores/store-1/listings/${LISTING_ID}`]: 401 }],
    ["categories", { "/stores/store-1/categories": 401 }],
    ["sellers", { "/stores/store-1/sellers": 401 }],
  ])("sends the member to login when the %s read is unauthorized", async (_name, override) => {
    stubAdminApi({ ...api(listingDetail()), ...override });
    await expect(EditListingPage(props)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login?error=session-expired"),
    });
  });

  it("rejects when the listing has the wrong shape", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stubAdminApi(api({ id: LISTING_ID }));
    await expect(EditListingPage(props)).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });
});
