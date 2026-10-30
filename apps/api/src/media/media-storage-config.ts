import { S3Client } from "@aws-sdk/client-s3";
import type { MediaConfig } from "@/config/config";
import { BucketStorage } from "./bucket-storage";
import { LocalDiskStorage } from "./local-disk-storage";
import type { MediaStorage } from "./media-storage";

/** The storage the parsed media config selects. */
export function mediaStorageFor(config: MediaConfig): MediaStorage {
  switch (config.kind) {
    case "disk":
      return new LocalDiskStorage(config.dir);
    case "bucket":
      return new BucketStorage(
        new S3Client({
          endpoint: config.endpoint,
          region: config.region,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey.reveal(),
          },
        }),
        config.bucket,
      );
  }
}
