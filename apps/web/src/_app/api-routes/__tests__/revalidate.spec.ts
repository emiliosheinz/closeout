/** @vitest-environment node */
import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { POST } from "@/_app/api-routes/revalidate";
import { getMe } from "@/entities/session/index.server";
import { meResponse } from "@/test/fixtures";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/entities/session/index.server", () => ({ getMe: vi.fn() }));

function expire(origin = "http://web:3000") {
  return POST(
    new NextRequest("http://web:3000/api/catalog/revalidate", {
      method: "POST",
      headers: { origin },
    }),
  );
}

describe("catalog revalidate route", () => {
  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = "http://web:3000";
    vi.mocked(revalidateTag).mockClear();
  });

  it("expires the catalog cache for a signed-in admin", async () => {
    vi.mocked(getMe).mockResolvedValue(meResponse());
    const res = await expire();
    expect(res.status).toBe(204);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("refuses visitors without a session", async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    expect((await expire()).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses cross-origin calls before checking the session", async () => {
    vi.mocked(getMe).mockClear();
    expect((await expire("https://evil.example")).status).toBe(403);
    expect(getMe).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
