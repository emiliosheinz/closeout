import { apiParsed } from "@/shared/api";
import { uploadPhotos } from "../upload-photos";

vi.mock("@/shared/api", async () => ({
  ...(await vi.importActual("@/shared/api")),
  apiParsed: vi.fn(),
}));

const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

describe("uploadPhotos", () => {
  it("reports the images the API returned", async () => {
    const image = {
      id: "i1",
      position: 0,
      width: 10,
      height: 10,
      urls: { sm: "s", lg: "l" },
    };
    vi.mocked(apiParsed).mockResolvedValue({
      parsed: true,
      data: { items: [image] },
    });
    const onBatch = vi.fn();
    await uploadPhotos("s", "l", [file], onBatch);
    expect(onBatch).toHaveBeenCalledWith({
      done: 1,
      total: 1,
      images: [image],
    });
  });

  it("reports progress without images when the answer could not be read", async () => {
    vi.mocked(apiParsed).mockResolvedValue({ parsed: false, data: null });
    const onBatch = vi.fn();
    await uploadPhotos("s", "l", [file], onBatch);
    expect(onBatch).toHaveBeenCalledWith({
      done: 1,
      total: 1,
      images: undefined,
    });
  });
});
