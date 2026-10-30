import { format, inspect } from "node:util";
import { Secret } from "./secret";

const VALUE = "sentinel-3f9a1c";

describe("Secret", () => {
  const secret = new Secret(VALUE);

  it("prints [Redacted] when serialised, inspected or interpolated", () => {
    expect(JSON.stringify({ secret })).toBe('{"secret":"[Redacted]"}');
    expect(inspect({ secret })).toBe("{ secret: [Redacted] }");
    expect(format("%o %O %s", secret, { secret }, secret)).not.toContain(VALUE);
    expect(`${secret}`).toBe("[Redacted]");
    expect(String(secret)).toBe("[Redacted]");
  });

  it("gives the value only when revealed", () => {
    expect(secret.reveal()).toBe(VALUE);
  });
});
