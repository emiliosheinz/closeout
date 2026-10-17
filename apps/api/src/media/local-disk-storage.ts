import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_FILE_PATTERN, type MediaStorage } from "./media-storage";

/** Stores media files flat in one directory (a Docker volume in dev). */
export class LocalDiskStorage implements MediaStorage {
  constructor(private readonly root: string) {}

  async put(name: string, data: Buffer): Promise<void> {
    const target = this.resolve(name);
    await mkdir(this.root, { recursive: true });
    // Write then rename so a reader never sees a half-written file.
    const temp = path.join(this.root, `.${randomUUID()}.tmp`);
    await writeFile(temp, data);
    await rename(temp, target);
  }

  async read(name: string): Promise<Buffer | null> {
    if (!MEDIA_FILE_PATTERN.test(name)) return null;
    try {
      return await readFile(this.resolve(name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async remove(name: string): Promise<void> {
    await rm(this.resolve(name), { force: true });
  }

  private resolve(name: string): string {
    if (!MEDIA_FILE_PATTERN.test(name)) {
      throw new Error(`Refusing unexpected media file name: ${name}`);
    }
    return path.join(this.root, name);
  }
}
