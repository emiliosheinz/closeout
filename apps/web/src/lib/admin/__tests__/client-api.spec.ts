/**
 * @jest-environment node
 */
import { ApiError, api } from "../client-api";

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
