import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 3;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const MIN_PASSWORD_LENGTH = 10;

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: 256 * cost * blockSize,
      },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/**
 * Hash a password into a self-describing string:
 * `scrypt$<N>$<r>$<p>$<salt b64>$<key b64>`. Parameters travel with the hash
 * so the cost can be raised later without invalidating existing rows.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** True when the stored hash was made with other parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const [scheme, cost, blockSize, parallelization] = stored.split("$");
  return (
    scheme !== "scrypt" ||
    Number(cost) !== COST ||
    Number(blockSize) !== BLOCK_SIZE ||
    Number(parallelization) !== PARALLELIZATION
  );
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, cost, blockSize, parallelization, salt, key] =
    stored.split("$");
  const params = [cost, blockSize, parallelization].map(Number);
  if (scheme !== "scrypt" || !salt || !key) return false;
  if (!params.every((value) => Number.isInteger(value) && value > 0)) {
    return false;
  }
  const expected = Buffer.from(key, "base64");
  const actual = await derive(
    password,
    Buffer.from(salt, "base64"),
    params[0] as number,
    params[1] as number,
    params[2] as number,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * A valid hash of a random password. Login verifies against it when the
 * email is unknown, so response time does not reveal which emails exist.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}
