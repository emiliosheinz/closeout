import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import {
  assertMediaFileName,
  MEDIA_FILE_PATTERN,
  type MediaStorage,
} from "./media-storage";

/** Stores media files as objects in one private S3-compatible bucket. */
export class BucketStorage implements MediaStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(name: string, data: Buffer): Promise<void> {
    assertMediaFileName(name);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: name, Body: data }),
    );
  }

  async read(name: string): Promise<Buffer | null> {
    if (!MEDIA_FILE_PATTERN.test(name)) return null;
    try {
      const object = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: name }),
      );
      if (!object.Body) return null;
      return Buffer.from(await object.Body.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async remove(name: string): Promise<void> {
    assertMediaFileName(name);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: name }),
    );
  }
}
