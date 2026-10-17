import sharp from "sharp";

/** Uploads with more pixels than this are rejected before decoding. */
export const MAX_INPUT_PIXELS = 40_000_000;

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class InvalidImageError extends Error {}

export interface ProcessedImage {
  width: number;
  height: number;
  variants: { suffix: "sm" | "lg" | "og"; ext: "webp" | "jpg"; data: Buffer }[];
}

/**
 * Validate an upload by decoding it (the client's MIME type and file name are
 * ignored) and produce the delivery variants:
 * - `sm`: 640px wide WebP for cards and thumbnails
 * - `lg`: 1600px wide WebP for the detail gallery
 * - `og`: 1200x630 JPEG cover crop for link previews (WhatsApp does not
 *   reliably render WebP previews)
 *
 * Re-encoding drops EXIF, including GPS coordinates from phone cameras.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const source = () =>
    sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

  let metadata: sharp.Metadata;
  try {
    // Header only, nothing is decoded yet: safe without the pixel limit, and
    // lets an oversized photo get its own explanation below.
    metadata = await sharp(input).metadata();
  } catch {
    throw new InvalidImageError("Arquivo não é uma imagem válida.");
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError("Use fotos em JPEG, PNG ou WebP.");
  }
  if (!metadata.width || !metadata.height) {
    throw new InvalidImageError("Arquivo não é uma imagem válida.");
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new InvalidImageError("A imagem tem resolução grande demais.");
  }

  try {
    const large = await source()
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    // Derived from the already-oriented, EXIF-free lg buffer: cheaper than
    // decoding the full-resolution source again.
    const small = await sharp(large.data)
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const og = await source()
      .rotate()
      .resize({ width: 1200, height: 630, fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return {
      width: large.info.width,
      height: large.info.height,
      variants: [
        { suffix: "sm", ext: "webp", data: small },
        { suffix: "lg", ext: "webp", data: large.data },
        { suffix: "og", ext: "jpg", data: og },
      ],
    };
  } catch {
    throw new InvalidImageError("Não foi possível processar a imagem.");
  }
}
