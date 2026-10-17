import { hashPassword, verifyPassword } from "./passwords";

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
});
