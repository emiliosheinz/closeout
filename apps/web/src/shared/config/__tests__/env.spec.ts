import { requireEnv, unusableEnv } from "@/shared/config/env";

const VALID = {
  PORT: "3000",
  HOSTNAME: "::",
  API_BASE_URL: "http://api.railway.internal:8080",
  PUBLIC_BASE_URL: "https://closeout.up.railway.app",
  INTERNAL_API_SECRET: "secret",
};

describe("unusableEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is empty when every variable is usable", () => {
    for (const [name, value] of Object.entries(VALID)) vi.stubEnv(name, value);
    expect(unusableEnv()).toEqual([]);
  });

  it("names every missing or invalid variable and nothing else", () => {
    for (const [name, value] of Object.entries(VALID)) vi.stubEnv(name, value);
    vi.stubEnv("PORT", "");
    vi.stubEnv("HOSTNAME", "");
    vi.stubEnv("API_BASE_URL", "not a url");
    vi.stubEnv("PUBLIC_BASE_URL", "https://");
    vi.stubEnv("INTERNAL_API_SECRET", "");
    expect(unusableEnv().sort()).toEqual(
      [
        "API_BASE_URL",
        "HOSTNAME",
        "INTERNAL_API_SECRET",
        "PORT",
        "PUBLIC_BASE_URL",
      ].sort(),
    );
  });
});

describe("requireEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the value when set", () => {
    vi.stubEnv("API_BASE_URL", "http://api:3000");
    expect(requireEnv("API_BASE_URL")).toBe("http://api:3000");
  });

  it("throws naming the variable when unset", () => {
    vi.stubEnv("API_BASE_URL", "");
    expect(() => requireEnv("API_BASE_URL")).toThrow(
      "Environment variable API_BASE_URL is not set",
    );
  });
});
