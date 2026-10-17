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
});
