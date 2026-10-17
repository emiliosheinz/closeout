import type { INestApplication } from "@nestjs/common";
import { configureApp } from "./configure-app";

describe("configureApp", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("refuses to boot with an internal secret shorter than 32 characters", () => {
    process.env.PUBLIC_BASE_URL = "http://storefront.test";
    process.env.INTERNAL_API_SECRET = "x".repeat(31);
    expect(() => configureApp({} as INestApplication)).toThrow(
      "INTERNAL_API_SECRET must be at least 32 characters",
    );
  });

  it("accepts an internal secret of exactly 32 characters", () => {
    process.env.PUBLIC_BASE_URL = "http://storefront.test";
    process.env.INTERNAL_API_SECRET = "x".repeat(32);
    const app = { disable: jest.fn(), use: jest.fn() };
    expect(() =>
      configureApp(app as unknown as INestApplication),
    ).not.toThrow();
  });
});
