import {
  Body,
  Controller,
  Get,
  HttpException,
  Module,
  Post,
} from "@nestjs/common";
import type { DestinationStream } from "pino";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  createTestApp,
  INTERNAL_SECRET,
  ORIGIN,
  type TestContext,
} from "./helpers";

const SENTINEL = "sentinel-0b9e4d";
const ERROR = 50;

@Controller("problem-probe")
class ProbeController {
  constructor(private readonly dataSource: DataSource) {}

  @Get("crash")
  crash() {
    throw new Error(SENTINEL);
  }

  @Get("library")
  library() {
    throw new HttpException({ detail: SENTINEL, message: SENTINEL }, 409);
  }

  @Get("query")
  query() {
    return this.dataSource.query("SELECT $1::uuid", [SENTINEL]);
  }

  @Post("echo")
  echo(@Body() body: unknown) {
    return { received: body };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

interface LogLine {
  level: number;
  msg: string;
  reqId?: string;
  err?: { stack?: string; code?: string };
  res?: { statusCode?: number };
}

describe("problem documents", () => {
  let ctx: TestContext;
  let chunks: string[] = [];
  const logs: DestinationStream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };
  const raw = () => chunks.join("");
  const lines = (): LogLine[] =>
    raw()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogLine);
  const errorLines = () =>
    lines().filter((line) => line.level >= ERROR && line.err !== undefined);
  /** The request's single completion line carries its id and status. */
  const completedOnce = (res: request.Response) => {
    expect(lines().filter((line) => line.res !== undefined)).toEqual([
      expect.objectContaining({
        reqId: res.headers["x-request-id"],
        res: { statusCode: res.status },
      }),
    ]);
  };
  const internalJson = (url: string) =>
    request(server())
      .post(url)
      .set("x-internal-secret", INTERNAL_SECRET)
      .set("x-client-ip", "192.0.2.80")
      .set("Content-Type", "application/json");
  const server = () => ctx.app.getHttpServer();

  /** Asserts the problem envelope and returns the body. */
  const problem = (res: request.Response, status: number) => {
    expect(res.status).toBe(status);
    expect(res.headers["content-type"]).toMatch(
      /^application\/problem\+json(;|$)/,
    );
    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
    expect(res.body).toMatchObject({
      type: "about:blank",
      title: expect.any(String),
      status,
      detail: expect.any(String),
      requestId: res.headers["x-request-id"],
    });
    return res.body as Record<string, unknown>;
  };

  beforeAll(async () => {
    ctx = await createTestApp([ProbeModule], logs);
  });
  beforeEach(() => {
    chunks = [];
  });
  afterAll(() => ctx.app.close());

  describe("an unexpected error", () => {
    it("answers 500 with generic copy and exactly the five members", async () => {
      const res = await request(server()).get("/problem-probe/crash");

      const body = problem(res, 500);
      expect(Object.keys(body).sort()).toEqual(
        ["detail", "requestId", "status", "title", "type"].sort(),
      );
      expect(body).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Algo deu errado. Tente novamente em instantes.",
        requestId: res.headers["x-request-id"],
      });
      expect(res.text).not.toContain(SENTINEL);
    });

    it("writes one error line with the stack and the request id", async () => {
      const res = await request(server())
        .get("/problem-probe/crash")
        .set("x-request-id", "crash-1");

      expect(res.headers["x-request-id"]).toBe("crash-1");
      const lines = errorLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]?.reqId).toBe("crash-1");
      expect(lines[0]?.err?.stack).toMatch(/^\s+at /);
    });
  });

  describe("a failing query", () => {
    it("answers 500 and logs the SQLSTATE without the bound value or driver message", async () => {
      const res = await request(server())
        .get("/problem-probe/query")
        .set("x-request-id", "query-1");

      expect(problem(res, 500).detail).toBe(
        "Algo deu errado. Tente novamente em instantes.",
      );
      expect(res.text).not.toContain(SENTINEL);
      const lines = errorLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        reqId: "query-1",
        err: { code: "22P02" },
      });
      expect(raw()).not.toContain(SENTINEL);
      expect(raw()).not.toContain("invalid input syntax");
    });
  });

  it("answers a library-raised HTTP exception with copy for its status, never its text", async () => {
    const res = await request(server()).get("/problem-probe/library");

    expect(problem(res, 409)).toEqual({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "Requisição inválida.",
      requestId: res.headers["x-request-id"],
    });
    expect(res.text).not.toContain(SENTINEL);
  });

  it("answers an unknown route with 404", async () => {
    const res = await request(server()).get(`/nope-${SENTINEL}`);

    expect(problem(res, 404)).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Não encontrado.",
      requestId: res.headers["x-request-id"],
    });
    expect(res.text).not.toContain(SENTINEL);
  });

  describe("request bodies the parser cannot take", () => {
    it("answers a malformed JSON body with 400 and never echoes or logs it", async () => {
      const res = await internalJson("/auth/login").send(
        `{"email": "a@example.com", "password": "${SENTINEL}`,
      );

      expect(problem(res, 400)).toEqual({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: "Não foi possível ler os dados enviados.",
        requestId: res.headers["x-request-id"],
      });
      expect(res.text).not.toContain(SENTINEL);
      expect(raw()).not.toContain(SENTINEL);
      completedOnce(res);
    });

    it("answers a JSON body over the size limit with 413", async () => {
      const res = await internalJson("/auth/login").send(
        JSON.stringify({
          email: "a@example.com",
          password: "x".repeat(200_000),
        }),
      );

      expect(problem(res, 413)).toEqual({
        type: "about:blank",
        title: "Payload Too Large",
        status: 413,
        detail: "Requisição grande demais.",
        requestId: res.headers["x-request-id"],
      });
      completedOnce(res);
    });

    it("reads a zero-length JSON body as an empty object", async () => {
      const res = await request(server())
        .post("/problem-probe/echo")
        .set("Origin", ORIGIN)
        .set("Content-Type", "application/json")
        .send("");

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ received: {} });
    });
  });

  it("answers a write from a foreign origin with 403", async () => {
    const res = await request(server())
      .post("/problem-probe/echo")
      .set("Origin", "https://elsewhere.example")
      .send({ name: "x" });

    expect(problem(res, 403)).toEqual({
      type: "about:blank",
      title: "Forbidden",
      status: 403,
      detail: "Origem não permitida.",
      requestId: res.headers["x-request-id"],
    });
    completedOnce(res);
  });
});
