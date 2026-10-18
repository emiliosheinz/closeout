import baseConfig from "@closeout/config/jest";
import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  ...baseConfig,
  testEnvironment: "jsdom",
  testRegex: "\\.no-such-suffix$",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns ?? []),
    "/e2e-tests/",
  ],
};

export default createJestConfig(config);
