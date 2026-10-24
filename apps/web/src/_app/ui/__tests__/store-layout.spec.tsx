/** @vitest-environment node */
import type { MockInstance } from "vitest";
import { StoreLayout } from "@/_app/ui/store-layout";

describe("store layout", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
  });
  afterEach(() => fetchMock.mockRestore());

  const render = (slug: string) =>
    StoreLayout({ children: "catalog", params: Promise.resolve({ slug }) });

  it("answers 404 before streaming when the store does not exist", async () => {
    fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(render("sumiu")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("renders the store that the path names", async () => {
    fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        slug: "nosso-desapego",
        name: "Loja",
        headline: "",
        intro: "",
        locale: "pt-BR",
        currency: "BRL",
        counts: { available: 0, reserved: 0, sold: 0 },
        categories: [],
        sellers: [],
      }),
    );
    await expect(render("nosso-desapego")).resolves.toBe("catalog");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api:3000/public/stores/nosso-desapego",
      expect.anything(),
    );
  });
});
