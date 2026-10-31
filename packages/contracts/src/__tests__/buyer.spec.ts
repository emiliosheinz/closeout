import { describe, expect, it } from "vitest";
import {
  buyerMergeRequestSchema,
  buyerNameKey,
  buyerNameSchema,
  buyerRefSchema,
  buyerUpdateRequestSchema,
  parseRequest,
} from "../schemas";

const ID = "0b6f1b44-6f3c-4b7a-8d3c-1f0a1c2d3e4f";
const INVALID_WHATSAPP =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";

describe("buyer ref", () => {
  it("stores the typed phone as digits", () => {
    expect(
      buyerRefSchema.parse({
        name: "Maria",
        whatsappNumber: "+55 (11) 98888-7777",
      }),
    ).toEqual({ name: "Maria", whatsappNumber: "5511988887777" });
  });

  it("refuses a phone without the plus sign", () => {
    const result = buyerRefSchema.safeParse({
      name: "Maria",
      whatsappNumber: "5511988887777",
    });
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      INVALID_WHATSAPP,
    );
  });

  it("accepts an id or a name, with an optional phone", () => {
    expect(buyerRefSchema.safeParse({ id: ID }).success).toBe(true);
    expect(buyerRefSchema.safeParse({ name: "Maria" }).success).toBe(true);
    expect(
      buyerRefSchema.safeParse({ id: ID, whatsappNumber: "+5511988887777" })
        .success,
    ).toBe(true);
  });

  it.each([
    ["both id and name", { id: ID, name: "Maria" }],
    ["neither", {}],
    ["only a phone", { whatsappNumber: "+5511988887777" }],
  ])("refuses %s", (_case, ref) => {
    expect(buyerRefSchema.safeParse(ref).success).toBe(false);
  });
});

describe("buyer name", () => {
  it("refuses a name that is blank after trimming", () => {
    expect(buyerNameSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts 120 characters and refuses 121", () => {
    expect(buyerNameSchema.safeParse("a".repeat(120)).success).toBe(true);
    expect(buyerNameSchema.safeParse("a".repeat(121)).success).toBe(false);
  });

  it("refuses a name whose key is empty", () => {
    expect(buyerNameSchema.safeParse("​‍").success).toBe(false);
  });
});

describe("buyer name key", () => {
  it.each([
    [" maria  sílva "],
    ["MARIA SILVA"],
    ["Maria Silva"],
    ["Ｍａｒｉａ Silva"],
    ["Mar​ia Silva"],
  ])("gives %j the key of Maria Silva", (name) => {
    expect(buyerNameKey(name)).toBe(buyerNameKey("Maria Silva"));
  });

  it("is lowercase, unaccented and single-spaced", () => {
    expect(buyerNameKey(" Maria  SÍLVA ")).toBe("maria silva");
  });

  it("is empty for invisible characters only", () => {
    expect(buyerNameKey("​ ‍")).toBe("");
  });
});

describe("buyer update request", () => {
  it.each([null, ""])("clears the phone with %j", (value) => {
    expect(
      parseRequest(buyerUpdateRequestSchema, { whatsappNumber: value }).data,
    ).toEqual({ whatsappNumber: null });
  });
});

describe("buyer merge request", () => {
  it("requires a uuid target", () => {
    expect(
      parseRequest(buyerMergeRequestSchema, { targetId: ID }).success,
    ).toBe(true);
    expect(
      parseRequest(buyerMergeRequestSchema, { targetId: "x" }).success,
    ).toBe(false);
    expect(parseRequest(buyerMergeRequestSchema, {}).success).toBe(false);
  });
});
