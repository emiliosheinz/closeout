import { isInternalRequest, trustedClientIp } from "./internal-request";

describe("internal requests", () => {
  const original = process.env.INTERNAL_API_SECRET;
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "the-real-secret";
  });
  afterAll(() => {
    process.env.INTERNAL_API_SECRET = original;
  });

  it("accepts only the exact shared secret", () => {
    expect(isInternalRequest({ "x-internal-secret": "the-real-secret" })).toBe(
      true,
    );
    expect(isInternalRequest({ "x-internal-secret": "the-real-secreT" })).toBe(
      false,
    );
    expect(isInternalRequest({ "x-internal-secret": "" })).toBe(false);
    expect(isInternalRequest({})).toBe(false);
  });

  it("trusts a forwarded client IP only on internal requests", () => {
    expect(
      trustedClientIp({
        "x-internal-secret": "the-real-secret",
        "x-client-ip": "203.0.113.9",
      }),
    ).toBe("203.0.113.9");
    expect(trustedClientIp({ "x-client-ip": "203.0.113.9" })).toBeNull();
    expect(
      trustedClientIp({
        "x-internal-secret": "wrong",
        "x-client-ip": "203.0.113.9",
      }),
    ).toBeNull();
  });
});
