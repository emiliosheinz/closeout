import { assertMediaFileName } from "./media-storage";

describe("assertMediaFileName", () => {
  it("accepts a generated variant name", () => {
    expect(() =>
      assertMediaFileName("0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-sm.webp"),
    ).not.toThrow();
  });

  it.each([
    "../x",
    "../0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-sm.webp",
    "0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-xl.webp",
    "",
  ])("rejects %p", (name) => {
    expect(() => assertMediaFileName(name)).toThrow(
      "Refusing unexpected media file name",
    );
  });
});
