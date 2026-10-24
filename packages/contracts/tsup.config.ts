import { defineConfig } from "tsup";

export default defineConfig({
  dts: true,
  clean: true,
  format: ["cjs", "esm"],
  treeshake: "recommended",
  entry: { enums: "src/enums.ts", schemas: "src/schemas/index.ts" },
});
