/**
 * @jest-environment node
 */
import { ApiError, api } from "../index";

function respondWith(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("api error messages", () => {
  it("passes the API's Portuguese messages through", async () => {
    respondWith(422, {
      message: "Adicione ao menos uma foto antes de publicar.",
    });
    await expect(api("PATCH", "/x")).rejects.toEqual(
      new ApiError(422, "Adicione ao menos uma foto antes de publicar."),
    );
  });

  it("keeps Portuguese validation messages and drops English framework ones", async () => {
    respondWith(400, {
      message: [
        "title must be shorter than or equal to 120 characters",
        "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
      ],
    });
    await expect(api("POST", "/x", {})).rejects.toThrow(
      "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.",
    );
  });

  it("falls back to a Portuguese summary when only English details exist", async () => {
    respondWith(400, { message: ["categoryId must be a UUID"] });
    await expect(api("POST", "/x", {})).rejects.toThrow(
      "Alguns campos estão inválidos. Confira e tente de novo.",
    );
    respondWith(500, { message: "Internal server error" });
    await expect(api("GET", "/x")).rejects.toThrow(
      "Não foi possível salvar. Tente de novo.",
    );
  });
});

describe("storefront cache expiry", () => {
  const ok = () => Response.json({ id: "x" });
  const calledUrls = () =>
    jest.mocked(global.fetch).mock.calls.map(([url]) => url);

  it("expires the catalog cache after a successful write", async () => {
    global.fetch = jest.fn().mockImplementation(async () => ok());
    await expect(api("PATCH", "/listings/x", {})).resolves.toEqual({
      id: "x",
    });
    expect(calledUrls()).toEqual([
      "/api/v1/listings/x",
      "/api/catalog/revalidate",
    ]);
  });

  it("leaves the cache alone on reads and failed writes", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(
        Response.json(
          { message: "Adicione ao menos uma foto." },
          { status: 422 },
        ),
      );
    await api("GET", "/listings");
    await expect(api("PATCH", "/listings/x", {})).rejects.toThrow();
    expect(calledUrls()).toEqual(["/api/v1/listings", "/api/v1/listings/x"]);
  });

  it("still resolves the write when the expiry call fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new TypeError("network down"));
    await expect(api("DELETE", "/listings/x")).resolves.toBeUndefined();
  });
});
