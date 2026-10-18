/** @jest-environment node */
import { GET } from "../app/health/route";

const VALID = {
  PORT: "3000",
  HOSTNAME: "::",
  API_BASE_URL: "http://api.railway.internal:8080",
  PUBLIC_BASE_URL: "https://closeout.up.railway.app",
  INTERNAL_API_SECRET: "s3cret-value-that-must-never-leak-0123456789",
  STORE_SLUG: "nosso-desapego",
};

describe("GET /health", () => {
  const original = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, VALID);
  });

  afterEach(() => {
    process.env = { ...original };
  });

  async function check() {
    const res = GET();
    return { status: res.status, body: await res.text() };
  }

  it("is ready when every required variable is usable", async () => {
    expect((await check()).status).toBe(200);
  });

  it.each(
    Object.keys(VALID),
  )("is not ready without %s, and names only it", async (name) => {
    delete process.env[name];
    const { status, body } = await check();
    expect(status).toBe(503);
    expect(JSON.parse(body).unusable).toEqual([name]);
  });

  it("never leaks the values of the other variables", async () => {
    delete process.env.API_BASE_URL;
    const { body } = await check();
    expect(body).not.toContain(VALID.INTERNAL_API_SECRET);
  });

  it.each([
    ["PUBLIC_BASE_URL", "https://"],
    ["API_BASE_URL", "http://:8080"],
  ])("is not ready when %s is %p", async (name, value) => {
    process.env[name] = value;
    const { status, body } = await check();
    expect(status).toBe(503);
    expect(JSON.parse(body).unusable).toEqual([name]);
  });
});
