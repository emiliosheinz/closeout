/** @vitest-environment node */
import { adminGet } from "../admin-get";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

const widget = {
  safeParse: (data: unknown) =>
    typeof data === "object" && data !== null && "id" in data
      ? { success: true as const, data: { id: String(data.id) } }
      : { success: false as const, error: new Error("bad widget") },
};

describe("adminGet", () => {
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    cookieGet.mockReturnValue({ value: "token" });
  });

  it("returns the parsed body and sends the session cookie", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json({ id: "x" }));
    await expect(adminGet("/me", widget)).resolves.toEqual({ id: "x" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api:3000/me");
  });

  it.each([400, 401, 404])("returns null for a %i", async (status) => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status }));
    await expect(adminGet("/me", widget)).resolves.toBeNull();
  });

  it("returns null without a session and does not call the API", async () => {
    cookieGet.mockReturnValue(undefined);
    const fetchMock = vi.spyOn(global, "fetch");
    await expect(adminGet("/me", widget)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs and throws when a required field is missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ name: "x" }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(adminGet("/me", widget)).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it("throws on a server error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    await expect(adminGet("/me", widget)).rejects.toThrow();
  });
});
