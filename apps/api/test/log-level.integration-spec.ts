import type { DestinationStream } from "pino";
import {
  as,
  createStoreWithAdmin,
  createTestApp,
  internalPost,
  resetDatabase,
  type TestContext,
} from "./helpers";

describe("log level", () => {
  let ctx: TestContext;
  const chunks: string[] = [];
  const logs: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };

  beforeAll(async () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    ctx = await createTestApp([], logs);
    vi.unstubAllEnvs();
  });
  afterAll(() => ctx.app.close());

  it("writes only lines at or above LOG_LEVEL", async () => {
    await resetDatabase(ctx.dataSource);
    const owner = await createStoreWithAdmin(ctx, "loja-a");
    await as(ctx.app, owner.cookie)
      .post(`/stores/${owner.storeId}/invites`)
      .send({ email: "nova@example.com", role: "seller" })
      .expect(201);
    await internalPost(ctx.app, "/auth/login", "198.51.100.7")
      .send({ email: owner.email, password: "wrong password" })
      .expect(401);

    const messages = chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line).msg);
    expect(messages).toContain("Failed login");
    expect(messages).not.toContain("Invite created");
  });
});
