import { screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { category, meResponse, seller } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { NewListingPage } from "../admin-listing-new-page";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual("next/navigation")),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

describe("new listing page", () => {
  it("renders the form with the store's categories from the first load", async () => {
    stubAdminApi({
      "/me": meResponse("owner"),
      "/stores/store-1/categories": { items: [category] },
      "/stores/store-1/sellers": { items: [seller("s-ana", "Ana")] },
    });
    renderPage(await NewListingPage());
    expect(screen.getByLabelText("Nome do item")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Categoria" }),
    ).toHaveTextContent("Móveis");
  });

  it.each([
    [
      "categories",
      {
        "/stores/store-1/categories": 401,
        "/stores/store-1/sellers": { items: [] },
      },
    ],
    [
      "sellers",
      {
        "/stores/store-1/categories": { items: [category] },
        "/stores/store-1/sellers": 401,
      },
    ],
  ])("sends the member to login when the %s read is unauthorized", async (_name, routes) => {
    stubAdminApi({ "/me": meResponse("owner"), ...routes });
    await expect(NewListingPage()).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/login?error=session-expired"),
    });
  });
});
