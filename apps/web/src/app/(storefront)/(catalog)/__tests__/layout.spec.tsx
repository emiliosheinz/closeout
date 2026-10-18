/** @jest-environment node */
import CatalogLayout from "../layout";

describe("catalog layout", () => {
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    process.env.STORE_SLUG = "loja";
  });
  afterEach(() => fetchMock.mockRestore());

  it("answers 404 before streaming when the store does not exist", async () => {
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(CatalogLayout({ children: "catalog" })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("renders the catalog when the store exists", async () => {
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json({ name: "Loja" }));
    await expect(CatalogLayout({ children: "catalog" })).resolves.toBe(
      "catalog",
    );
  });
});
