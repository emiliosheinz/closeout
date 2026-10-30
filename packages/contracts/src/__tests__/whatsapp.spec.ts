import { describe, expect, it } from "vitest";
import {
  parseRequest,
  whatsappDigitsSchema,
  whatsappInputSchema,
} from "../schemas";

const MESSAGE =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";

describe("WhatsApp input rule", () => {
  it.each([
    ["+55 11 99999-8888", "5511999998888"],
    ["+55 (11) 99999-8888", "5511999998888"],
    [" +1 415.555.0100 ", "14155550100"],
  ])("stores %j as %j", (input, digits) => {
    expect(whatsappInputSchema.parse(input)).toBe(digits);
  });

  it.each([
    ["no plus sign", "5511999998888"],
    ["a zero country code", "+0 11 99999 8888"],
    ["no country code", "11 99999-8888"],
    ["letters", "+55 abc"],
    ["too few digits", "+1234567"],
    ["too many digits", "+1234567890123456"],
    ["a number", 5511999998888],
  ])("rejects %s with the country-code hint", (_case, input) => {
    for (const result of [
      whatsappInputSchema.safeParse(input),
      parseRequest(whatsappInputSchema, input),
    ]) {
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        MESSAGE,
      ]);
    }
  });
});

describe("stored WhatsApp rule", () => {
  it("accepts international digits", () => {
    expect(whatsappDigitsSchema.safeParse("5511999998888").success).toBe(true);
  });

  it.each([
    "+5511999998888",
    "55 11 99999 8888",
    "0511999998888",
    "1234567",
  ])("rejects %j", (stored) => {
    expect(whatsappDigitsSchema.safeParse(stored).success).toBe(false);
  });
});
