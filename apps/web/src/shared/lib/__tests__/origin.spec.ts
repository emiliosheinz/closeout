import { clientIpFrom, isSameOrigin } from "../origin";

describe("isSameOrigin", () => {
  const base = "https://desapego.example/";
  it("accepts only the storefront origin", () => {
    expect(isSameOrigin("https://desapego.example", base)).toBe(true);
    expect(isSameOrigin("https://evil.example", base)).toBe(false);
    expect(isSameOrigin("http://desapego.example", base)).toBe(false);
    expect(isSameOrigin(null, base)).toBe(false);
  });
});

describe("clientIpFrom", () => {
  it("returns the trimmed X-Real-IP, null when blank", () => {
    expect(clientIpFrom("203.0.113.5")).toBe("203.0.113.5");
    expect(clientIpFrom(" 203.0.113.5 ")).toBe("203.0.113.5");
    expect(clientIpFrom(null)).toBeNull();
    expect(clientIpFrom(" ")).toBeNull();
  });
});
