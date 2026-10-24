import { screen } from "@testing-library/react";
import { stubAdminApi } from "@/test/admin-api";
import { LISTING_ID, meResponse } from "@/test/fixtures";
import { renderPage } from "@/test/render-page";
import { PreviewPage } from "../admin-listing-preview-page";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const props = { params: Promise.resolve({ id: LISTING_ID }) };
const path = `/stores/store-1/listings/${LISTING_ID}/preview`;

const detail = {
  slug: "sofa-azul",
  title: "Sofá azul",
  priceCents: 120000,
  condition: "good",
  availability: "available",
  category: { slug: "moveis", name: "Móveis" },
  cover: null,
  description: "Sofá de três lugares.",
  attributes: [],
  images: [],
  sellers: [],
  canContact: false,
  publishedAt: null,
  updatedAt: "2026-10-17T12:00:00.000Z",
  related: [],
};

describe("listing preview page", () => {
  it("renders the listing title from the first load", async () => {
    stubAdminApi({ "/me": meResponse(), [path]: detail });
    renderPage(await PreviewPage(props));
    expect(
      screen.getByRole("heading", { level: 1, name: "Sofá azul" }),
    ).toBeInTheDocument();
  });

  it("shows not-found when the listing does not exist", async () => {
    stubAdminApi({ "/me": meResponse(), [path]: 404 });
    await expect(PreviewPage(props)).rejects.toMatchObject({
      digest: expect.stringContaining("404"),
    });
  });

  it("sends the member to login when the preview read is unauthorized", async () => {
    stubAdminApi({ "/me": meResponse(), [path]: 401 });
    await expect(PreviewPage(props)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/entrar?erro=sessao-expirada"),
    });
  });

  it("rejects when the listing has the wrong shape", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    stubAdminApi({ "/me": meResponse(), [path]: { slug: "sofa-azul" } });
    await expect(PreviewPage(props)).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });
});
