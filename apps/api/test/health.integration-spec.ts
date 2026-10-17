import request from "supertest";
import { createTestApp, type TestContext } from "./helpers";

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
    expect(res.body).toEqual({ status: "ok" });
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
