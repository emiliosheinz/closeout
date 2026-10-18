import baseConfig from "@closeout/config/jest";
import type { Config } from "jest";

const config: Config = {
  ...baseConfig,
  roots: ["<rootDir>/src"],
};

export default config;
