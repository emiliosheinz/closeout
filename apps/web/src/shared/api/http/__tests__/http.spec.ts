/**
 * @vitest-environment node
 */
import oracle from "@/test/copy-oracle.json";
import { problemResponse } from "@/test/fixtures";
import { ApiError } from "../api-error";
import { api, apiGet, apiParsed } from "../client";
import type { Schema } from "../schema";

const widget: Schema<{ id: string }> = {
  safeParse: (data) =>
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string"
      ? { success: true, data: { id: data.id } }
      : { success: false, error: new Error("bad widget") },
};

function respondWith(status: number, body: unknown) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("api error messages", () => {
  it.each([
    ["listing", 422, "Adicione ao menos uma foto antes de publicar."],
    ["photos", 422, "A nova ordem precisa conter todas as fotos do anúncio."],
    ["seller", 404, "Vendedor não encontrado."],
    ["store", 403, "Você não tem permissão para esta ação."],
    ["team", 404, "Membro não encontrado."],
    ["invites", 409, "Este e-mail já tem uma conta."],
  ])("shows the %s problem's detail", async (_source, status, detail) => {
    global.fetch = vi.fn().mockResolvedValue(problemResponse(status, detail));
    await expect(api("PATCH", "/x", {})).rejects.toEqual(
      new ApiError(status, detail),
    );
  });

  it("shows a detail with no Portuguese words untouched", async () => {
    global.fetch = vi.fn().mockResolvedValue(problemResponse(409, "Duda: 3"));
    await expect(api("POST", "/x", {})).rejects.toThrow("Duda: 3");
  });

  it("keys field errors by pointer, keeping the first message for each", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      problemResponse(400, "Informe seu nome.", [
        { pointer: "/name", detail: "Informe seu nome." },
        { pointer: "/whatsappNumber", detail: "Informe o WhatsApp." },
        { pointer: "/name", detail: "Nome longo demais." },
      ]),
    );
    const error = await api("POST", "/x", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      message: "Informe seu nome.",
      fieldErrors: {
        "/name": "Informe seu nome.",
        "/whatsappNumber": "Informe o WhatsApp.",
      },
    });
  });

  it.each([
    ["an HTML page", "<html>Bad Gateway</html>"],
    ["an empty body", ""],
    ["a body that is not a problem", JSON.stringify({ message: "Erro." })],
  ])("falls back to today's copy for %s", async (_name, body) => {
    global.fetch = vi.fn(
      async () => new Response(body, { status: 400 }),
    ) as typeof fetch;
    await expect(api("POST", "/x", {})).rejects.toEqual(
      new ApiError(400, oracle.adminInvalidFields),
    );
    global.fetch = vi.fn(
      async () => new Response(body, { status: 502 }),
    ) as typeof fetch;
    await expect(api("POST", "/x", {})).rejects.toEqual(
      new ApiError(502, oracle.adminGenericError),
    );
  });
});

describe("storefront cache expiry", () => {
  const ok = () => Response.json({ id: "x" });
  const calledUrls = () =>
    vi.mocked(global.fetch).mock.calls.map(([url]) => url);

  it("expires the catalog cache after a successful write", async () => {
    global.fetch = vi.fn().mockImplementation(async () => ok());
    await expect(
      apiParsed("PATCH", "/listings/x", {}, widget),
    ).resolves.toEqual({ parsed: true, data: { id: "x" } });
    expect(calledUrls()).toEqual([
      "/api/v1/listings/x",
      "/api/catalog/revalidate",
    ]);
  });

  it("leaves the cache alone on reads and failed writes", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(
        Response.json(
          { message: "Adicione ao menos uma foto." },
          { status: 422 },
        ),
      );
    await apiGet("/listings", widget);
    await expect(api("PATCH", "/listings/x", {})).rejects.toThrow();
    expect(calledUrls()).toEqual(["/api/v1/listings", "/api/v1/listings/x"]);
  });

  it("still resolves the write when the expiry call fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new TypeError("network down"));
    await expect(api("DELETE", "/listings/x")).resolves.toBeUndefined();
  });
});

describe("failures", () => {
  it("reports a request that never arrives as status 0 with Portuguese copy", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("POST", "/x", {})).rejects.toEqual(
      new ApiError(0, oracle.networkFailure),
    );
  });

  it("reports a 401 as status 401 without navigating", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    global.fetch = vi
      .fn()
      .mockResolvedValue(problemResponse(401, "Entre para continuar."));
    await expect(api("PATCH", "/x", {})).rejects.toMatchObject({
      status: 401,
      message: "Sua sessão expirou. Entre de novo.",
    });
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reports a 401 on a read without navigating", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    respondWith(401, { message: "Unauthorized" });
    await expect(apiGet("/x", widget)).rejects.toMatchObject({
      status: 401,
    });
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("response shape", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves a write whose body fails the schema, flagged and logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    respondWith(201, { name: "no id" });
    await expect(apiParsed("POST", "/x", {}, widget)).resolves.toEqual({
      parsed: false,
      data: { name: "no id" },
    });
    expect(error).toHaveBeenCalled();
  });

  it("still expires the catalog cache for a write with a bad body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockImplementation(async () => Response.json({}));
    await apiParsed("POST", "/x", {}, widget);
    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/x",
      "/api/catalog/revalidate",
    ]);
  });

  it("throws the generic error when a read fails the schema", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    respondWith(200, { name: "no id" });
    await expect(apiGet("/x", widget)).rejects.toEqual(
      new ApiError(500, oracle.adminGenericError),
    );
    expect(error).toHaveBeenCalled();
  });
});
