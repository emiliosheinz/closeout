/**
 * @vitest-environment node
 */
import oracle from "@/test/copy-oracle.json";
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
      oracle.adminInvalidFields,
    );
    respondWith(500, { message: "Internal server error" });
    await expect(api("POST", "/x")).rejects.toThrow(oracle.adminGenericError);
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
    respondWith(401, { message: "Unauthorized" });
    await expect(api("PATCH", "/x", {})).rejects.toMatchObject({
      status: 401,
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
