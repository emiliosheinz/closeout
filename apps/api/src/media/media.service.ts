import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { processImage } from "./image-processor";
import { MEDIA_STORAGE, type MediaStorage } from "./media-storage";
import { mediaFileNames } from "./media-urls";

export interface StoredImage {
  key: string;
  width: number;
  height: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  /**
   * Process and persist every variant of an upload. If any write fails the
   * variants already written are removed, so storage never holds a partial
   * image. Throws `InvalidImageError` for unusable input.
   */
  async store(input: Buffer): Promise<StoredImage> {
    const processed = await processImage(input);
    const key = randomUUID();
    const written: string[] = [];
    try {
      for (const variant of processed.variants) {
        const name = `${key}-${variant.suffix}.${variant.ext}`;
        await this.storage.put(name, variant.data);
        written.push(name);
      }
    } catch (err) {
      await Promise.all(written.map((name) => this.storage.remove(name)));
      throw err;
    }
    return { key, width: processed.width, height: processed.height };
  }

  /**
   * Remove every variant of an image. Called after the owning row is gone;
   * a failure leaves an orphan file, which is logged rather than surfaced
   * because the user-visible state is already consistent.
   */
  async remove(key: string): Promise<void> {
    for (const name of mediaFileNames(key)) {
      try {
        await this.storage.remove(name);
      } catch (err) {
        this.logger.error(`Failed to remove media file ${name}`, err);
      }
    }
  }

  read(name: string): Promise<Buffer | null> {
    return this.storage.read(name);
  }
}
