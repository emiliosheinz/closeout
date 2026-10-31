import { describe, expect, it } from "vitest";
import {
  parseRequest,
  waitlistFieldsSchema,
  waitlistRefSchema,
  waitlistSignupRequestSchema,
  waitlistSrcSchema,
} from "../schemas";

const WHATSAPP =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";
const EMAIL = "Informe um e-mail válido.";
const INVALID_VALUE = "Valor inválido.";

const valid = {
  name: "Ana",
  channel: "whatsapp",
  contact: "+55 (11) 99999-8888",
};

/** A well-formed address of exactly `length` characters. */
function email(length: number) {
  return `${"a".repeat(length - "@example.com".length)}@example.com`;
}

function parse(input: unknown) {
  return parseRequest(waitlistSignupRequestSchema, input);
}

function firstIssue(input: unknown) {
  const result = parse(input);
  expect(result.success).toBe(false);
  const [issue] = result.error?.issues ?? [];
  const key = issue?.code === "unrecognized_keys" ? issue.keys : [];
  return { path: [...(issue?.path ?? []), ...key], message: issue?.message };
}

describe("waitlist signup request", () => {
  it("normalizes a WhatsApp contact to digits and keeps ref and src", () => {
    expect(
      parse({ ...valid, ref: "loja-x", src: "catalog-footer" }).data,
    ).toEqual({
      name: "Ana",
      channel: "whatsapp",
      contact: "5511999998888",
      ref: "loja-x",
      src: "catalog-footer",
    });
  });

  it("trims and lowercases an e-mail contact", () => {
    expect(
      parse({ ...valid, channel: "email", contact: "  Ana@Example.COM " }).data
        ?.contact,
    ).toBe("ana@example.com");
  });

  it("trims the name", () => {
    expect(parse({ ...valid, name: "  Ana  " }).data?.name).toBe("Ana");
  });

  it("accepts a missing ref and src and any website text", () => {
    const result = parse({ ...valid, website: "http://spam.example" });
    expect(result.success).toBe(true);
    expect(result.data?.ref).toBeUndefined();
    expect(result.data?.src).toBeUndefined();
    expect(result.data?.website).toBe("http://spam.example");
  });

  it.each([
    ["a 100 character name", { name: "n".repeat(100) }],
    ["an 8 digit WhatsApp number", { contact: "+12345678" }],
    ["a 15 digit WhatsApp number", { contact: "+123456789012345" }],
    [
      "a 254 character e-mail",
      { channel: "email", contact: ` ${email(254)} ` },
    ],
    ["a 100 character ref", { ref: "r".repeat(100) }],
  ])("accepts %s", (_label, change) => {
    expect(parse({ ...valid, ...change }).success).toBe(true);
  });

  it.each([
    [
      "a WhatsApp number without the plus",
      { contact: "11 99999-8888" },
      "/contact",
      WHATSAPP,
    ],
    [
      "a 7 digit WhatsApp number",
      { contact: "+1234567" },
      "/contact",
      WHATSAPP,
    ],
    [
      "a 16 digit WhatsApp number",
      { contact: "+1234567890123456" },
      "/contact",
      WHATSAPP,
    ],
    [
      "an e-mail without a domain",
      { channel: "email", contact: "ana@" },
      "/contact",
      EMAIL,
    ],
    [
      "a 255 character e-mail",
      { channel: "email", contact: email(255) },
      "/contact",
      EMAIL,
    ],
    ["a blank name", { name: "   " }, "/name", "Informe seu nome."],
    [
      "a 101 character name",
      { name: "n".repeat(101) },
      "/name",
      "Use até 100 caracteres no nome.",
    ],
    [
      "an unknown channel",
      { channel: "sms" },
      "/channel",
      "Escolha WhatsApp ou e-mail.",
    ],
    [
      "a ref with spaces and capitals",
      { ref: "Loja X" },
      "/ref",
      INVALID_VALUE,
    ],
    ["a 101 character ref", { ref: "r".repeat(101) }, "/ref", INVALID_VALUE],
    ["an empty ref", { ref: "" }, "/ref", INVALID_VALUE],
    ["an unknown src", { src: "footer" }, "/src", INVALID_VALUE],
    ["an extra field", { foo: "x" }, "/foo", "Campo não permitido."],
  ])("rejects %s", (_label, change, pointer, message) => {
    const issue = firstIssue({ ...valid, ...change });
    expect(`/${issue.path.join("/")}`).toBe(pointer);
    expect(issue.message).toBe(message);
  });

  it("checks the contact by the channel it names", () => {
    expect(
      parse({ ...valid, channel: "email", contact: "+5511999998888" }).success,
    ).toBe(false);
    expect(
      parse({ ...valid, channel: "whatsapp", contact: "ana@example.com" })
        .success,
    ).toBe(false);
  });
});

describe("waitlist fields", () => {
  it("validates without ref, src or website", () => {
    expect(waitlistFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it("reports an invalid contact on the contact field", () => {
    const result = waitlistFieldsSchema.safeParse({
      ...valid,
      contact: "11 9999",
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["contact"],
      message: WHATSAPP,
    });
  });
});

describe("waitlist ref and src", () => {
  it.each(["loja-x", "a", "loja-2"])("accepts ref %s", (ref) => {
    expect(waitlistRefSchema.safeParse(ref).success).toBe(true);
  });

  it.each([
    "",
    "Loja X",
    "-loja",
    "loja--x",
    "r".repeat(101),
  ])("rejects ref %j", (ref) => {
    expect(waitlistRefSchema.safeParse(ref).success).toBe(false);
  });

  it.each(["catalog-footer", "landing", "login"])("accepts src %s", (src) => {
    expect(waitlistSrcSchema.safeParse(src).success).toBe(true);
  });

  it("rejects an unknown src", () => {
    expect(waitlistSrcSchema.safeParse("footer").success).toBe(false);
  });
});
