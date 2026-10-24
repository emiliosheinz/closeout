import { isManager } from "../is-manager";

describe("isManager", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["seller", false],
  ] as const)("maps %s to %s", (role, expected) => {
    expect(isManager(role)).toBe(expected);
  });
});
