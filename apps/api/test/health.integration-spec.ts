import type { DestinationStream } from "pino";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers";
import { startTcpProxy, type TcpProxy } from "./tcp-proxy";

describe("health", () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());

  it("reports ok with baseline security headers", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/health")
      .expect(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "up" } });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("forbids caching of API responses by default", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get("/health")
      .expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("applies the statement timeout to pooled connections", async () => {
    const [row] = await ctx.dataSource.query("SHOW statement_timeout");
    expect(row.statement_timeout).toBe("10s");
    const [idle] = await ctx.dataSource.query(
      "SHOW idle_in_transaction_session_timeout",
    );
    expect(idle.idle_in_transaction_session_timeout).toBe("30s");
  });
});

describe("health against an unreachable database", () => {
  let ctx: TestContext;
  let proxy: TcpProxy;
  let chunks: string[] = [];
  const logs: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };
  const warnLines = () =>
    chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .filter((line) => JSON.parse(line).level === 40);
  const health = () => request(ctx.app.getHttpServer()).get("/health");

  beforeAll(async () => {
    proxy = await startTcpProxy(
      process.env.POSTGRES_HOST ?? "",
      Number(process.env.POSTGRES_PORT),
    );
    vi.stubEnv("POSTGRES_HOST", "127.0.0.1");
    vi.stubEnv("POSTGRES_PORT", String(proxy.port));
    ctx = await createTestApp([], logs);
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    proxy.setMode("forward");
    chunks = [];
  });
  afterAll(async () => {
    proxy.setMode("forward");
    await ctx.app.close();
    await proxy.close();
  });

  const expectDown = (res: request.Response, outcome: string) => {
    expect(res.status).toBe(503);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.body).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "Serviço indisponível no momento.",
      requestId: expect.any(String),
      checks: { database: "down" },
    });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers["cache-control"]).toBe("no-store");
    const warnings = warnLines();
    expect(warnings).toHaveLength(1);
    expect(JSON.parse(warnings[0] ?? "{}").outcome).toBe(outcome);
    for (const text of [JSON.stringify(res.body), ...warnings]) {
      expect(text).not.toContain("127.0.0.1");
      expect(text).not.toContain(String(proxy.port));
      expect(text).not.toMatch(/ECONN|terminated|timeout expired|Connection/i);
    }
  };

  it("reports the database up through the proxy", async () => {
    const res = await health().expect(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "up" } });
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("answers 503 without driver details when the database refuses connections", async () => {
    proxy.setMode("refuse");
    expectDown(await health(), "failed");
  });

  it("answers 503 within the ping timeout when the database stops replying, and recovers", async () => {
    await health().expect(200);
    proxy.setMode("blackhole");
    const started = Date.now();
    const res = await health();
    expect(Date.now() - started).toBeLessThan(3_000 + 1_000);
    expectDown(res, "timeout");

    proxy.setMode("forward");
    const restored = Date.now();
    let status = 0;
    while (status !== 200 && Date.now() - restored < 15_000) {
      status = (await health()).status;
    }
    expect(status).toBe(200);
  });
});
