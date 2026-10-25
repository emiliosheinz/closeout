import { existsSync } from "node:fs";
import { resolve } from "node:path";
import inventory from "../spec-inventory.json";

const webRoot = resolve(__dirname, "../../..");
const entries = Object.entries(inventory as Record<string, string>);

describe("spec inventory", () => {
  it("lists exactly the 37 specs that existed before the Vitest migration", () => {
    expect(entries).toHaveLength(37);
    expect(new Set(entries.map(([base]) => base)).size).toBe(37);
  });

  it.each(entries)("%s is kept as %s", (_base, current) => {
    expect(existsSync(resolve(webRoot, current))).toBe(true);
  });
});
