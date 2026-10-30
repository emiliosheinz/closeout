import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // esbuild cannot emit the decorator metadata Nest injection relies on.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
