import { isManager } from "../current-store";

jest.mock("../server-api", () => ({ getMe: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

describe("isManager", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["seller", false],
  ] as const)("maps %s to %s", (role, expected) => {
    expect(isManager(role)).toBe(expected);
  });
});
