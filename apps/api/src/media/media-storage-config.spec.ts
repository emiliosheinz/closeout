import { type PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Secret } from "@/config/secret";
import { BucketStorage } from "./bucket-storage";
import { LocalDiskStorage } from "./local-disk-storage";
import { mediaStorageFor } from "./media-storage-config";

const BUCKET = {
  kind: "bucket",
  endpoint: "https://storage.example",
  region: "iad",
  bucket: "media",
  accessKeyId: "key",
  secretAccessKey: new Secret("secret"),
} as const;

describe("mediaStorageFor", () => {
  it("uses the bucket for a bucket configuration", () => {
    expect(mediaStorageFor(BUCKET)).toBeInstanceOf(BucketStorage);
  });

  it("writes to the configured bucket with the revealed credentials", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    const storage = mediaStorageFor(BUCKET);
    await storage.put(
      "0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-sm.webp",
      Buffer.from([1]),
    );
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command.input.Bucket).toBe("media");
    const client = send.mock.contexts[0] as S3Client;
    expect(await client.config.credentials()).toMatchObject({
      accessKeyId: "key",
      secretAccessKey: "secret",
    });
    send.mockRestore();
  });

  it("uses local disk for a disk configuration", () => {
    expect(
      mediaStorageFor({ kind: "disk", dir: "/data/media" }),
    ).toBeInstanceOf(LocalDiskStorage);
  });
});
