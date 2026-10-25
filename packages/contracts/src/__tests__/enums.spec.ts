import { describe, expect, it } from "vitest";
import {
  ASSIGNABLE_ROLES,
  AVAILABILITIES,
  CONDITIONS,
  PUBLICATIONS,
  STORE_ROLES,
} from "../enums";

describe("enum value lists", () => {
  it("lists conditions", () => {
    expect([...CONDITIONS]).toEqual([
      "new",
      "like_new",
      "good",
      "fair",
      "for_parts",
    ]);
  });

  it("lists availabilities", () => {
    expect([...AVAILABILITIES]).toEqual(["available", "reserved", "sold"]);
  });

  it("lists publications", () => {
    expect([...PUBLICATIONS]).toEqual(["draft", "published", "archived"]);
  });

  it("lists store roles", () => {
    expect([...STORE_ROLES]).toEqual(["owner", "admin", "seller"]);
  });

  it("lists assignable roles without the owner", () => {
    expect([...ASSIGNABLE_ROLES]).toEqual(["admin", "seller"]);
  });
});
