/** @vitest-environment node */
import { lookupInvite } from "../lookup-invite";

describe("lookupInvite", () => {
  beforeEach(() => {
    process.env.API_BASE_URL = "http://api:3000";
    process.env.INTERNAL_API_SECRET = "secret";
  });

  it("returns the invite the API describes and ignores unknown fields", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({
        storeName: "Loja",
        email: "eva@loja.test",
        role: "seller",
        extra: 1,
      }),
    );
    await expect(lookupInvite("t", "1.2.3.4")).resolves.toEqual({
      state: "valid",
      invite: { storeName: "Loja", email: "eva@loja.test", role: "seller" },
    });
  });

  it("logs and throws when the invite is missing a field", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ storeName: "Loja" }),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(lookupInvite("t", null)).rejects.toThrow();
    expect(logged).toHaveBeenCalled();
  });

  it("reports unknown tokens as invalid and rate limits as too many", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(lookupInvite("t", null)).resolves.toEqual({
      state: "invalid",
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));
    await expect(lookupInvite("t", null)).resolves.toEqual({
      state: "too-many",
    });
  });
});
