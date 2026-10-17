import { randomBytes, scrypt } from "node:crypto";
import { hashPassword, needsRehash, verifyPassword } from "./passwords";

/** A hash in the previous format (p=1), as already stored for existing users. */
function legacyHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 2 ** 15, r: 8, p: 1, maxmem: 256 * 2 ** 15 * 8 },
      (err, key) =>
        err
          ? reject(err)
          : resolve(
              `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`,
            ),
    );
  });
}

describe("passwords", () => {
  it("stores a salted scrypt hash that does not contain the password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse battery");
    expect(await hashPassword("correct horse battery")).not.toBe(hash);
  });

  it("accepts the original password and rejects any other", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3")).toBe(false);
    expect(await verifyPassword("x", "scrypt$x$8$1$c2FsdA==$a2V5")).toBe(false);
  });

  it("hashes new passwords with parallelization 3", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.split("$").slice(1, 4)).toEqual(["32768", "8", "3"]);
  });

  it("flags hashes with older parameters for rehash but not fresh ones", async () => {
    expect(needsRehash(await legacyHash("pw"))).toBe(true);
    expect(needsRehash(await hashPassword("pw"))).toBe(false);
  });

  it("still verifies hashes made with older parameters", async () => {
    const hash = await legacyHash("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
