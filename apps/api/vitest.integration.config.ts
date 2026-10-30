import { register } from "tsx/cjs/api";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// TypeORM loads migrations by glob with Node's own require, outside Vitest's
// transform, and the generated migrations import types as values, which
// Node's type stripping rejects. tsx compiles them instead: here for the
// global setup, through execArgv for the test workers.
register();

export default defineConfig({
  // esbuild cannot emit the decorator metadata Nest injection relies on.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ["test/**/*.integration-spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    execArgv: ["--require", "tsx/cjs"],
    // One database per run, shared by every file: files must not interleave.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
