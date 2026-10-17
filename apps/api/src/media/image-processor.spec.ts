import sharp from "sharp";
import { InvalidImageError, processImage } from "./image-processor";

function encoded(
  format: "gif" | "tiff" | "png" | "jpeg",
  width = 64,
  height = 64,
) {
  return sharp({ create: { width, height, channels: 3, background: "#456" } })
    .toFormat(format)
    .toBuffer();
}

describe("processImage", () => {
  it.each(["gif", "tiff"] as const)("rejects %s uploads", async (format) => {
    await expect(processImage(await encoded(format))).rejects.toThrow(
      new InvalidImageError("Use fotos em JPEG, PNG ou WebP."),
    );
  });

  it("rejects SVG documents", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    );
    await expect(processImage(svg)).rejects.toThrow(
      "Use fotos em JPEG, PNG ou WebP.",
    );
  });

  it("rejects images above 40 megapixels with a resolution message", async () => {
    const huge = await sharp({
      create: { width: 8000, height: 5001, channels: 3, background: "#fff" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
    await expect(processImage(huge)).rejects.toThrow(
      "A imagem tem resolução grande demais.",
    );
  });

  it("produces the three delivery variants with the resized dimensions", async () => {
    const result = await processImage(await encoded("jpeg", 2000, 1000));
    expect([result.width, result.height]).toEqual([1600, 800]);
    expect(result.variants.map((v) => `${v.suffix}.${v.ext}`)).toEqual([
      "sm.webp",
      "lg.webp",
      "og.jpg",
    ]);
  });
});
