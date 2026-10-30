import { describe, expect, it } from "vitest";
import * as schemas from "../schemas";
import { problemDocumentSchema } from "../schemas";

const serverError = {
  type: "about:blank",
  title: "Internal Server Error",
  status: 500,
  detail: "Algo deu errado. Tente novamente em instantes.",
  requestId: "req-1",
};

describe("problem document", () => {
  it("accepts a 500 with the five members", () => {
    expect(problemDocumentSchema.safeParse(serverError).success).toBe(true);
  });

  it("accepts a 400 whose detail repeats its first field error", () => {
    const problem = {
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Informe o nome.",
      requestId: "req-2",
      errors: [
        { pointer: "/name", detail: "Informe o nome." },
        { pointer: "/attributes/0/label", detail: "Informe o rótulo." },
      ],
    };
    expect(problemDocumentSchema.safeParse(problem).success).toBe(true);
  });

  it("rejects a 400 whose detail differs from its first field error", () => {
    const problem = {
      ...serverError,
      status: 400,
      detail: "Requisição inválida.",
      errors: [{ pointer: "/name", detail: "Informe o nome." }],
    };
    expect(problemDocumentSchema.safeParse(problem).success).toBe(false);
  });

  it("rejects empty field errors", () => {
    expect(
      problemDocumentSchema.safeParse({ ...serverError, errors: [] }).success,
    ).toBe(false);
  });

  it.each(["up", "down"])("accepts database checks %s", (database) => {
    const problem = {
      ...serverError,
      status: 503,
      title: "Service Unavailable",
      checks: { database },
    };
    expect(problemDocumentSchema.safeParse(problem).success).toBe(true);
  });

  it("rejects a body with only a message", () => {
    expect(
      problemDocumentSchema.safeParse({ statusCode: 400, message: "Erro" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-numeric status", () => {
    expect(
      problemDocumentSchema.safeParse({ ...serverError, status: "500" })
        .success,
    ).toBe(false);
  });
});

describe("problem copy", () => {
  it.each([
    ["GENERIC_500", "Algo deu errado. Tente novamente em instantes."],
    ["BAD_REQUEST", "Requisição inválida."],
    ["MALFORMED_BODY", "Não foi possível ler os dados enviados."],
    ["UNAUTHORIZED", "Entre para continuar."],
    ["FORBIDDEN", "Você não tem permissão para esta ação."],
    ["ORIGIN_FORBIDDEN", "Origem não permitida."],
    ["NOT_FOUND", "Não encontrado."],
    ["NO_CLIENT_IP", "Não foi possível identificar a origem da requisição."],
    [
      "TOO_MANY_ATTEMPTS",
      "Muitas tentativas. Tente novamente em alguns minutos.",
    ],
    ["PAYLOAD_TOO_LARGE", "Requisição grande demais."],
    ["SERVICE_UNAVAILABLE", "Serviço indisponível no momento."],
    ["UNKNOWN_FIELD", "Campo não permitido."],
    ["SESSION_EXPIRED", "Sua sessão expirou. Entre de novo."],
    ["LOGIN_INVALID", "Informe um e-mail válido e a senha."],
    ["LOGIN_FAILED", "Não foi possível entrar agora."],
  ])("exports %s", (key, text) => {
    expect((schemas as Record<string, unknown>)[key]).toBe(text);
  });
});
