import { Secret } from "@/config/secret";
import { isInternalRequest, trustedClientIp } from "./internal-request";

describe("internal requests", () => {
  const secret = new Secret("the-real-secret");

  it("accepts only the exact shared secret", () => {
    expect(
      isInternalRequest({ "x-internal-secret": "the-real-secret" }, secret),
    ).toBe(true);
    expect(
      isInternalRequest({ "x-internal-secret": "the-real-secreT" }, secret),
    ).toBe(false);
    expect(isInternalRequest({ "x-internal-secret": "" }, secret)).toBe(false);
    expect(isInternalRequest({}, secret)).toBe(false);
  });

  it("trusts a forwarded client IP only on internal requests", () => {
    expect(
      trustedClientIp(
        {
          "x-internal-secret": "the-real-secret",
          "x-client-ip": "203.0.113.9",
        },
        secret,
      ),
    ).toBe("203.0.113.9");
    expect(
      trustedClientIp({ "x-client-ip": "203.0.113.9" }, secret),
    ).toBeNull();
    expect(
      trustedClientIp(
        {
          "x-internal-secret": "wrong",
          "x-client-ip": "203.0.113.9",
        },
        secret,
      ),
    ).toBeNull();
  });
});
