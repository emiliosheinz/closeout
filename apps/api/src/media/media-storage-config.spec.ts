import { type PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BucketStorage } from "./bucket-storage";
import { LocalDiskStorage } from "./local-disk-storage";
import { mediaStorageFromEnv } from "./media-storage-config";

const BUCKET_ENV = {
  S3_ENDPOINT: "https://storage.example",
  S3_REGION: "iad",
  S3_BUCKET: "media",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("mediaStorageFromEnv", () => {
  it("uses the bucket when all five S3 variables are set, even with MEDIA_DIR", () => {
    expect(
      mediaStorageFromEnv({ ...BUCKET_ENV, MEDIA_DIR: "/data/media" }),
    ).toBeInstanceOf(BucketStorage);
  });

  it("writes to the configured bucket", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    await mediaStorageFromEnv(BUCKET_ENV).put(
      "0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-sm.webp",
      Buffer.from([1]),
    );
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command.input.Bucket).toBe("media");
    send.mockRestore();
  });

  it("uses local disk when no S3 variable is set and MEDIA_DIR is", () => {
    expect(mediaStorageFromEnv({ MEDIA_DIR: "/data/media" })).toBeInstanceOf(
      LocalDiskStorage,
    );
  });

  it.each([
    [["S3_BUCKET"], "S3_BUCKET must be set"],
    [
      ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
      "S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY must be set",
    ],
    [
      ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID"],
      "S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID must be set",
    ],
  ])("refuses a partial bucket configuration missing %p, even with MEDIA_DIR", (unset, message) => {
    const env: NodeJS.ProcessEnv = { ...BUCKET_ENV, MEDIA_DIR: "/data/media" };
    for (const name of unset) delete env[name];
    expect(() => mediaStorageFromEnv(env)).toThrow(message);
  });

  it("refuses to start with neither bucket nor MEDIA_DIR configured", () => {
    expect(() => mediaStorageFromEnv({})).toThrow("MEDIA_DIR must be set");
  });
});
