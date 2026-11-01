import { apiGet } from "@/shared/api";
import { buyerSummary } from "@/test/fixtures";
import { buyerReads } from "../reads";

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("buyerReads.list", () => {
  it("fetches the store's buyers and yields the parsed items", async () => {
    const buyer = buyerSummary({ name: "Maria Silva" });
    const fetchMock = stubFetch({ items: [buyer] });
    const read = buyerReads.list("store-1");

    await expect(apiGet(read.path, read.schema)).resolves.toEqual({
      items: [buyer],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/stores/store-1/buyers");
  });

  it("fails when the body breaks the schema", async () => {
    stubFetch({ items: [{ id: "b-1", name: 7 }] });
    const read = buyerReads.list("store-1");

    await expect(apiGet(read.path, read.schema)).rejects.toThrow();
  });
});
