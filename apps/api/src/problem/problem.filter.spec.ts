import {
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AppException } from "./app-exception";
import { ProblemFilter } from "./problem.filter";

interface Written {
  status?: number;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

function write(exception: unknown): Written {
  const written: Written = { headers: {} };
  const response = {
    setHeader(name: string, value: string) {
      written.headers[name] = value;
    },
    status(status: number) {
      written.status = status;
      return response;
    },
    type(type: string) {
      written.headers["Content-Type"] = type;
      return response;
    },
    json(body: Record<string, unknown>) {
      written.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: "req-7" }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  new ProblemFilter().catch(exception, host);
  return written;
}

describe("problem filter", () => {
  beforeAll(() => Logger.overrideLogger(false));

  it("writes an app exception's status, detail and extensions", () => {
    const written = write(
      new AppException(HttpStatus.TOO_MANY_REQUESTS, "Espere um pouco.", {
        errors: [{ pointer: "/name", detail: "Espere um pouco." }],
        checks: { database: "down" },
        retryAfter: 42,
      }),
    );

    expect(written).toEqual({
      status: 429,
      headers: {
        "Content-Type": "application/problem+json",
        "Retry-After": "42",
      },
      body: {
        type: "about:blank",
        title: "Too Many Requests",
        status: 429,
        detail: "Espere um pouco.",
        requestId: "req-7",
        errors: [{ pointer: "/name", detail: "Espere um pouco." }],
        checks: { database: "down" },
      },
    });
  });

  it("writes only the five members for an app exception without extensions", () => {
    const written = write(
      new AppException(HttpStatus.CONFLICT, "Este e-mail já tem conta."),
    );

    expect(written.headers).toEqual({
      "Content-Type": "application/problem+json",
    });
    expect(written.body).toEqual({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "Este e-mail já tem conta.",
      requestId: "req-7",
    });
  });

  it.each([
    [400, "Bad Request", "Requisição inválida."],
    [401, "Unauthorized", "Entre para continuar."],
    [403, "Forbidden", "Você não tem permissão para esta ação."],
    [404, "Not Found", "Não encontrado."],
    [409, "Conflict", "Requisição inválida."],
    [413, "Payload Too Large", "Requisição grande demais."],
    [
      429,
      "Too Many Requests",
      "Muitas tentativas. Tente novamente em alguns minutos.",
    ],
    [502, "Bad Gateway", "Algo deu errado. Tente novamente em instantes."],
    [503, "Service Unavailable", "Serviço indisponível no momento."],
  ])("answers any other HTTP exception with status %i by its status copy", (status, title, detail) => {
    const written = write(
      new HttpException(
        { detail: "library text", message: "library text" },
        status,
      ),
    );

    expect(written.status).toBe(status);
    expect(written.body).toEqual({
      type: "about:blank",
      title,
      status,
      detail,
      requestId: "req-7",
    });
  });

  it("never reads a framework exception's message", () => {
    const written = write(new NotFoundException("Cannot GET /nope"));

    expect(written.body?.detail).toBe("Não encontrado.");
  });

  it.each([
    ["an error", new Error("secret internals")],
    ["a thrown string", "secret internals"],
    [
      "an error carrying its own detail",
      Object.assign(new Error("secret internals"), {
        status: 400,
        detail: "secret internals",
      }),
    ],
  ])("answers %s with a generic 500", (_case, thrown) => {
    const written = write(thrown);

    expect(written.status).toBe(500);
    expect(written.body).toEqual({
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: "Algo deu errado. Tente novamente em instantes.",
      requestId: "req-7",
    });
  });
});
