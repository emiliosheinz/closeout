import { uploadPhotos } from "../upload-photos";

function answerUploadsWith(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/v1")
        ? Response.json(body)
        : new Response(null, { status: 204 }),
    ),
  );
}

const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

describe("uploadPhotos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports the images the API returned", async () => {
    const image = {
      id: "i1",
      position: 0,
      width: 10,
      height: 10,
      urls: { sm: "s", lg: "l" },
    };
    answerUploadsWith({ items: [image] });
    const onBatch = vi.fn();
    await uploadPhotos("s", "l", [file], onBatch);
    expect(onBatch).toHaveBeenCalledWith({
      done: 1,
      total: 1,
      images: [image],
    });
  });

  it("reports progress without images when the answer could not be read", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    answerUploadsWith({ unexpected: true });
    const onBatch = vi.fn();
    await uploadPhotos("s", "l", [file], onBatch);
    expect(onBatch).toHaveBeenCalledWith({
      done: 1,
      total: 1,
      images: undefined,
    });
    expect(logged).toHaveBeenCalled();
  });
});
