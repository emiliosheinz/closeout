import { createListingWithPhotos } from "../save-listing";

const fields = {
  title: "Mesa",
  description: "",
  categoryId: "c",
  priceCents: null,
  condition: "good",
  attributes: [],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => Response.json({ oops: true }, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("createListingWithPhotos", () => {
  it("reports an upload failure when publishing was asked but the created id is unreadable, even with no photos", async () => {
    const outcome = await createListingWithPhotos("store", fields, [], {
      publish: true,
      onProgress: vi.fn(),
    });

    expect(outcome).toEqual({ id: null, notice: "upload-failed" });
    const listingCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("/api/v1"),
    );
    expect(listingCalls).toHaveLength(1);
  });

  it("reports a plain save when nothing else was pending and the id is unreadable", async () => {
    const outcome = await createListingWithPhotos("store", fields, [], {
      publish: false,
      onProgress: vi.fn(),
    });

    expect(outcome).toEqual({ id: null, notice: "saved" });
  });
});
