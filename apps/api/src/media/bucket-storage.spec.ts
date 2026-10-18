import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { BucketStorage } from "./bucket-storage";

const NAME = "0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b-sm.webp";
const BUCKET = "media";

/** In-memory stand-in for the bucket, behind the S3 client's `send`. */
function fakeBucket() {
  const objects = new Map<string, Buffer>();
  const send = jest.fn(async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      const { Bucket, Key, Body } = command.input;
      objects.set(`${Bucket}/${Key}`, Buffer.from(Body as Buffer));
      return {};
    }
    if (command instanceof GetObjectCommand) {
      const { Bucket, Key } = command.input;
      const data = objects.get(`${Bucket}/${Key}`);
      if (!data) {
        throw new NoSuchKey({ message: "missing", $metadata: {} });
      }
      return {
        Body: { transformToByteArray: async () => new Uint8Array(data) },
      };
    }
    if (command instanceof DeleteObjectCommand) {
      const { Bucket, Key } = command.input;
      objects.delete(`${Bucket}/${Key}`);
      return {};
    }
    throw new Error("unexpected command");
  });
  const storage = new BucketStorage({ send } as unknown as S3Client, BUCKET);
  return { storage, send, objects };
}

describe("BucketStorage", () => {
  it("reads back the bytes it stored", async () => {
    const { storage, objects } = fakeBucket();
    await storage.put(NAME, Buffer.from([1, 2, 3]));
    expect(await storage.read(NAME)).toEqual(Buffer.from([1, 2, 3]));
    expect([...objects.keys()]).toEqual([`media/${NAME}`]);
  });

  it("reads null after a remove", async () => {
    const { storage } = fakeBucket();
    await storage.put(NAME, Buffer.from([1]));
    await storage.remove(NAME);
    expect(await storage.read(NAME)).toBeNull();
  });

  it("reads null for a missing object", async () => {
    const { storage } = fakeBucket();
    expect(await storage.read(NAME)).toBeNull();
  });

  it("removes a missing object without error", async () => {
    const { storage } = fakeBucket();
    await expect(storage.remove(NAME)).resolves.toBeUndefined();
  });

  it("refuses invalid names without calling the bucket", async () => {
    const { storage, send } = fakeBucket();
    await expect(storage.put("../x", Buffer.from([1]))).rejects.toThrow(
      "Refusing unexpected media file name",
    );
    await expect(storage.remove("../x")).rejects.toThrow(
      "Refusing unexpected media file name",
    );
    expect(await storage.read("../x")).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it("propagates bucket errors other than a missing object", async () => {
    const { storage, send } = fakeBucket();
    const denied = new S3ServiceException({
      name: "AccessDenied",
      $fault: "client",
      $metadata: {},
    });
    send.mockRejectedValueOnce(denied);
    await expect(storage.read(NAME)).rejects.toBe(denied);
  });
});
