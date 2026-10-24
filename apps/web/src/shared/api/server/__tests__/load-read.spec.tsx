import { dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "../../query/query-client";
import { loadRead } from "../load-read";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token" }) }),
}));

const widget = {
  safeParse: (data: unknown) =>
    typeof data === "object" && data !== null && "id" in data
      ? { success: true as const, data: { id: String(data.id) } }
      : { success: false as const, error: new Error("bad widget") },
};
const read = {
  queryKey: ["widgets", "w-1"],
  path: "/widgets/w-1",
  schema: widget,
};
const cached = () =>
  dehydrate(getQueryClient()).queries.map((query) => query.queryKey);

describe("loadRead", () => {
  beforeEach(() => {
    getQueryClient().clear();
    process.env.API_BASE_URL = "http://api:3000";
  });

  it("returns the value and leaves it in the request's cache under its key", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ id: "w-1" }));
    await expect(loadRead(read)).resolves.toEqual({ id: "w-1" });
    expect(cached()).toEqual([["widgets", "w-1"]]);
  });

  it("returns null for a missing resource and caches nothing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    await expect(loadRead(read)).resolves.toBeNull();
    expect(cached()).toEqual([]);
  });

  it("rejects without retrying when the body has the wrong shape", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(Response.json({ name: "x" }));
    await expect(loadRead(read)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
