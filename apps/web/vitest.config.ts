import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const compilerPreset = reactCompilerPreset();
// Async components are server components, which Next never compiles; keep
// them out of the compiler here too (specs call them as plain functions).
const { code } = compilerPreset.rolldown?.filter ?? {};
compilerPreset.rolldown = {
  ...compilerPreset.rolldown,
  filter: {
    code: { include: code as RegExp, exclude: /async function [A-Z]/ },
  },
};

export default defineConfig({
  plugins: [react(), babel({ presets: [compilerPreset] })],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": new URL("./src/test/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    // Above the 5 s async-query wait in vitest.setup.ts, so a wait that never
    // settles fails with the rendered page instead of a bare test timeout.
    testTimeout: 15_000,
  },
});
