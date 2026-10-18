import nextConfig from "../../next.config";

async function cspOf(config: typeof nextConfig): Promise<string | undefined> {
  const rules = (await config.headers?.()) ?? [];
  return rules
    .find((r) => r.source === "/:path*")
    ?.headers.find((h) => h.key === "Content-Security-Policy")?.value;
}

describe("next config headers", () => {
  it("sends a restrictive CSP on all routes", async () => {
    const csp = await cspOf(nextConfig);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  it("drops dev-only eval and ws: in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      let loaded: typeof nextConfig | undefined;
      jest.isolateModules(() => {
        loaded = require("../../next.config").default;
      });
      if (!loaded) throw new Error("config not loaded");
      const csp = await cspOf(loaded);
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).not.toContain("unsafe-eval");
      expect(csp).not.toContain("ws:");
    } finally {
      env.NODE_ENV = original;
    }
  });
});

it("fails on purpose", () => {
  expect(1).toBe(2);
});
