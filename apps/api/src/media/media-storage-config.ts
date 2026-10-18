import { S3Client } from "@aws-sdk/client-s3";
import { BucketStorage } from "./bucket-storage";
import { LocalDiskStorage } from "./local-disk-storage";
import type { MediaStorage } from "./media-storage";

const BUCKET_VARIABLES = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

/**
 * Bucket storage when any `S3_*` variable is set (then all five must be),
 * otherwise local disk under `MEDIA_DIR`. A partial bucket configuration
 * never falls back to disk: in production that would silently keep uploads
 * on a container filesystem that the next deploy discards.
 */
export function mediaStorageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MediaStorage {
  const missing = BUCKET_VARIABLES.filter((name) => !env[name]);
  if (missing.length === 0) {
    const client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      },
    });
    return new BucketStorage(client, env.S3_BUCKET as string);
  }
  if (missing.length < BUCKET_VARIABLES.length) {
    throw new Error(`${missing.join(", ")} must be set`);
  }
  if (!env.MEDIA_DIR) throw new Error("MEDIA_DIR must be set");
  return new LocalDiskStorage(env.MEDIA_DIR);
}
