import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  acceptInviteRequestSchema,
  inviteLookupRequestSchema,
  inviteRequestSchema,
  loginRequestSchema,
  memberRequestSchema,
  parseRequest,
  sellerRequestSchema,
  storeRequestSchema,
} from "../schemas";

const INVALID_EMAIL = "Informe um e-mail válido.";
const WHATSAPP =
  "Informe o WhatsApp com o código do país, por exemplo +55 11 99999-8888.";
const INVALID_VALUE = "Valor inválido.";

const login = { email: "ana@example.com", password: "p" };
const accept = { token: "t".repeat(43), name: "Ana", password: "x".repeat(10) };

function firstIssue(result: z.ZodSafeParseResult<unknown>) {
  expect(result.success).toBe(false);
  const [issue] = result.error?.issues ?? [];
  return { path: issue?.path, message: issue?.message };
}

/** Parsed through the entry and without it, the first issue is the same. */
function bothWays(schema: z.ZodType, input: unknown) {
  const issue = firstIssue(parseRequest(schema, input));
  expect(firstIssue(schema.safeParse(input))).toEqual(issue);
  return issue;
}

describe("login request", () => {
  it("caps the trimmed email at 254 characters", () => {
    const email = `${"a".repeat(244)}@email.com`;
    expect(email).toHaveLength(254);
    expect(
      parseRequest(loginRequestSchema, { ...login, email: ` ${email} ` }).data,
    ).toEqual({ ...login, email });
    expect(
      bothWays(loginRequestSchema, { ...login, email: `a${email}` }),
    ).toEqual({
      path: ["email"],
      message: INVALID_EMAIL,
    });
  });

  it("accepts any address the shared email rule accepts", () => {
    expect(
      parseRequest(loginRequestSchema, { ...login, email: "a@b.c" }).success,
    ).toBe(true);
  });

  it.each(['"a b"@x.com', "a@b", 7])("rejects %j at the email", (email) => {
    expect(bothWays(loginRequestSchema, { ...login, email })).toEqual({
      path: ["email"],
      message: INVALID_EMAIL,
    });
  });

  it.each([
    ["", "Informe sua senha."],
    [7, "Informe sua senha."],
    ["x".repeat(201), "Use até 200 caracteres na senha."],
  ])("rejects the password %j", (password, message) => {
    expect(bothWays(loginRequestSchema, { ...login, password })).toEqual({
      path: ["password"],
      message,
    });
  });
});

describe("invite request", () => {
  it("lowercases the email", () => {
    expect(
      parseRequest(inviteRequestSchema, {
        email: " Ana@Example.COM ",
        role: "seller",
      }).data,
    ).toEqual({ email: "ana@example.com", role: "seller" });
  });

  it.each([
    [{ email: "a b@c.com", role: "seller" }, ["email"], INVALID_EMAIL],
    [
      { email: `${"a".repeat(245)}@email.com`, role: "seller" },
      ["email"],
      INVALID_EMAIL,
    ],
    [
      { email: "a@b.com", role: "owner" },
      ["role"],
      "Escolha o papel da pessoa.",
    ],
  ])("rejects %j", (body, path, message) => {
    expect(bothWays(inviteRequestSchema, body)).toEqual({ path, message });
  });
});

describe("invite token", () => {
  it.each([
    ["one character", "t"],
    ["200 characters", "t".repeat(200)],
  ])("accepts %s", (_case, token) => {
    expect(parseRequest(inviteLookupRequestSchema, { token }).success).toBe(
      true,
    );
    expect(
      parseRequest(acceptInviteRequestSchema, { ...accept, token }).success,
    ).toBe(true);
  });

  it.each([
    ["empty", "", INVALID_VALUE],
    ["201 characters", "t".repeat(201), INVALID_VALUE],
    ["missing", undefined, "Preencha este campo."],
  ])("rejects a token that is %s", (_case, token, message) => {
    expect(
      firstIssue(parseRequest(inviteLookupRequestSchema, { token })),
    ).toEqual({ path: ["token"], message });
    expect(
      firstIssue(parseRequest(acceptInviteRequestSchema, { ...accept, token })),
    ).toEqual({ path: ["token"], message });
  });
});

describe("invite accept", () => {
  it.each([
    [{ name: " " }, ["name"], "Informe seu nome."],
    [{ name: 7 }, ["name"], "Informe seu nome."],
    [{ name: "x".repeat(61) }, ["name"], "Use até 60 caracteres no nome."],
    [
      { password: "x".repeat(9) },
      ["password"],
      "A senha precisa ter pelo menos 10 caracteres.",
    ],
    [
      { password: 7 },
      ["password"],
      "A senha precisa ter pelo menos 10 caracteres.",
    ],
    [
      { password: "x".repeat(201) },
      ["password"],
      "Use até 200 caracteres na senha.",
    ],
    [{ whatsappNumber: "5511999998888" }, ["whatsappNumber"], WHATSAPP],
    [{ whatsappNumber: "+0 11 99999 8888" }, ["whatsappNumber"], WHATSAPP],
  ])("rejects %j", (change, path, message) => {
    expect(
      bothWays(acceptInviteRequestSchema, { ...accept, ...change }),
    ).toEqual({ path, message });
  });
});

describe("WhatsApp number on invite accept and seller update", () => {
  it.each([
    ["+55 11 99999-8888", "5511999998888"],
    ["  ", null],
    ["", null],
    [null, null],
  ])("stores %j as %j", (whatsappNumber, stored) => {
    expect(
      parseRequest(acceptInviteRequestSchema, { ...accept, whatsappNumber })
        .data?.whatsappNumber,
    ).toBe(stored);
    expect(parseRequest(sellerRequestSchema, { whatsappNumber }).data).toEqual({
      whatsappNumber: stored,
    });
  });

  it("leaves an absent number absent", () => {
    expect(parseRequest(sellerRequestSchema, {}).data).toEqual({});
  });

  it.each([
    "5511999998888",
    "+0 11 99999 8888",
    "+55 abc",
    5511999998888,
  ])("rejects %j on seller update", (whatsappNumber) => {
    expect(bothWays(sellerRequestSchema, { whatsappNumber })).toEqual({
      path: ["whatsappNumber"],
      message: WHATSAPP,
    });
  });
});

describe("seller update", () => {
  it.each([
    [{ displayName: " " }, "Informe o nome."],
    [{ displayName: null }, "Informe o nome."],
    [{ displayName: "x".repeat(61) }, "Use até 60 caracteres no nome."],
  ])("rejects %j", (body, message) => {
    expect(bothWays(sellerRequestSchema, body)).toEqual({
      path: ["displayName"],
      message,
    });
  });
});

describe("store update", () => {
  it.each([
    [{ name: " " }, ["name"], "Informe o nome da loja."],
    [{ name: 7 }, ["name"], "Informe o nome da loja."],
    [
      { name: "x".repeat(81) },
      ["name"],
      "Use até 80 caracteres no nome da loja.",
    ],
    [{ headline: 7 }, ["headline"], "Escreva a chamada principal como texto."],
    [
      { headline: "x".repeat(161) },
      ["headline"],
      "Use até 160 caracteres na chamada principal.",
    ],
    [{ intro: 7 }, ["intro"], "Escreva a apresentação como texto."],
    [
      { intro: "x".repeat(1201) },
      ["intro"],
      "Use até 1200 caracteres na apresentação.",
    ],
  ])("rejects %j", (body, path, message) => {
    expect(bothWays(storeRequestSchema, body)).toEqual({ path, message });
  });
});

describe("member update", () => {
  it("refuses making someone an owner", () => {
    expect(bothWays(memberRequestSchema, { role: "owner" })).toEqual({
      path: ["role"],
      message: "Escolha o papel da pessoa.",
    });
  });
});

describe("member request schemas are strict", () => {
  it.each([
    ["login", loginRequestSchema, login],
    ["invite", inviteRequestSchema, { email: "a@b.com", role: "admin" }],
    ["invite lookup", inviteLookupRequestSchema, { token: "t" }],
    ["invite accept", acceptInviteRequestSchema, accept],
    ["seller update", sellerRequestSchema, {}],
    ["store update", storeRequestSchema, {}],
    ["member update", memberRequestSchema, { role: "seller" }],
  ] as const)("%s refuses an unknown key", (_name, schema, valid) => {
    expect(parseRequest(schema, valid).success).toBe(true);
    expect(
      firstIssue(parseRequest(schema, { ...valid, isAdmin: true })),
    ).toEqual({
      path: [],
      message: "Campo não permitido.",
    });
  });

  it("gives a missing required field the pt-BR fallback through the entry", () => {
    expect(firstIssue(parseRequest(acceptInviteRequestSchema, {}))).toEqual({
      path: ["token"],
      message: "Preencha este campo.",
    });
  });
});
