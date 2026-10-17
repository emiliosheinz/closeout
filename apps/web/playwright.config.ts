import { defineConfig, devices } from "@playwright/test";

if (!process.env.E2E_APP_BASE_URL) {
  throw new Error("Environment variable E2E_APP_BASE_URL is not set");
}

export default defineConfig({
  testDir: "./e2e-tests",
  // The journeys share one store and build on each other's state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_APP_BASE_URL,
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
