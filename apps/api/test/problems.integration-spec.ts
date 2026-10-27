import { Controller, Get, HttpException, Module } from "@nestjs/common";
import type { DestinationStream } from "pino";
import request from "supertest";
import { DataSource } from "typeorm";
import { createTestApp, type TestContext } from "./helpers";

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
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

interface LogLine {
  level: number;
  msg: string;
  reqId?: string;
  err?: { stack?: string; code?: string };
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
  const errorLines = (): LogLine[] =>
    raw()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogLine)
      .filter((line) => line.level >= ERROR && line.err !== undefined);
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
});
