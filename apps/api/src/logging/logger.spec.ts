import type { DestinationStream } from "pino";
import { QueryFailedError } from "typeorm";
import { serverScope } from "@/config/config";
import { parseEnv } from "@/config/report";
import { createLogger } from "./logger";

const SENTINEL = "sentinel-7f3a9c";
const INFO = { level: "info", format: "json" } as const;

function memory(): DestinationStream & { lines: () => string[] } {
  const chunks: string[] = [];
  return {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
    lines: () => chunks.join("").split("\n").filter(Boolean),
  };
}

function onlyLine(destination: { lines: () => string[] }): string {
  const lines = destination.lines();
  expect(lines).toHaveLength(1);
  return lines[0] ?? "";
}

function records(destination: { lines: () => string[] }) {
  return destination.lines().map((line) => JSON.parse(line));
}

/** A server error as pg reports it: the message echoes the bound value. */
function pgError(): Error {
  return Object.assign(
    new Error(`invalid input syntax for type uuid: "${SENTINEL}"`),
    {
      severity: "ERROR",
      code: "22P02",
      table: "listings",
      constraint: "listings_slug_uq",
      detail: `Key (slug)=(${SENTINEL}) already exists.`,
    },
  );
}

describe("logger", () => {
  it("writes one JSON object with level, time and msg per line to an injected destination", () => {
    const out = memory();
    const logger = createLogger(INFO, out);

    logger.info("started");
    logger.warn({ storeId: "s1" }, "slow");
    logger.error({ err: new Error("boom") }, "failed");

    const lines = out.lines();
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(JSON.parse(line)).toEqual(
        expect.objectContaining({
          level: expect.any(Number),
          time: expect.any(Number),
          msg: expect.any(String),
        }),
      );
    }
  });

  it("logs an error's type, message, code and stack frames", () => {
    const out = memory();
    const err = Object.assign(new Error("disk full"), { code: "ENOSPC" });

    createLogger(INFO, out).error({ err }, "write failed");

    const [record] = records(out);
    expect(record.err).toEqual({
      type: "Error",
      message: "disk full",
      code: "ENOSPC",
      stack: expect.stringMatching(/^\s+at /),
    });
  });

  it("logs only the SQLSTATE and object names of a wrapped driver error", () => {
    const out = memory();
    const err = new QueryFailedError(
      `SELECT * FROM listings WHERE id = '${SENTINEL}'`,
      [SENTINEL],
      pgError(),
    );

    createLogger(INFO, out).error({ err }, "query failed");

    const line = onlyLine(out);
    expect(JSON.parse(line).err).toEqual({
      type: "QueryFailedError",
      code: "22P02",
      table: "listings",
      constraint: "listings_slug_uq",
      stack: expect.stringMatching(/^\s+at /),
    });
    expect(line).not.toContain(SENTINEL);
  });

  it("never takes the message of a line logged without one from a driver error", () => {
    const out = memory();
    const logger = createLogger(INFO, out);
    const err = new QueryFailedError("SELECT $1::uuid", [SENTINEL], pgError());

    logger.error({ err });
    logger.error(err);
    logger.error(new Error("disk full"));

    const lines = out.lines();
    expect(lines.map((line) => JSON.parse(line).msg)).toEqual([
      "QueryFailedError",
      "QueryFailedError",
      "disk full",
    ]);
    expect(lines.join("\n")).not.toContain(SENTINEL);
  });

  it("logs only the SQLSTATE and object names of a bare driver error", () => {
    const out = memory();

    createLogger(INFO, out).error({ err: pgError() }, "query failed");

    const line = onlyLine(out);
    expect(JSON.parse(line).err).toMatchObject({ code: "22P02" });
    expect(line).not.toContain(SENTINEL);
  });

  it.each([
    "password",
    "token",
    "sessionToken",
    "link",
    "authorization",
    "cookie",
    "set-cookie",
    "x-internal-secret",
  ])("redacts %s at the top level and nested", (key) => {
    const out = memory();

    createLogger(INFO, out).info(
      {
        [key]: SENTINEL,
        body: { [key]: SENTINEL },
        upstream: { headers: { [key]: SENTINEL } },
      },
      "request",
    );

    const line = onlyLine(out);
    const record = JSON.parse(line);
    expect(record[key]).toBe("[Redacted]");
    expect(record.body[key]).toBe("[Redacted]");
    expect(record.upstream.headers[key]).toBe("[Redacted]");
    expect(line).not.toContain(SENTINEL);
  });

  it("prints no secret of a logged config", () => {
    const parsed = parseEnv(serverScope, {
      PORT: "3000",
      HOST: "0.0.0.0",
      PUBLIC_BASE_URL: "https://loja.example",
      INTERNAL_API_SECRET: `${SENTINEL}-internal-0123456789abcdef`,
      POSTGRES_HOST: "db.internal",
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "store",
      POSTGRES_USER: "owner",
      POSTGRES_PASSWORD: `${SENTINEL}-db`,
      S3_ENDPOINT: "https://storage.example",
      S3_REGION: "iad",
      S3_BUCKET: "media",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: `${SENTINEL}-bucket`,
    });
    if (!parsed.ok) throw new Error(parsed.problems.join("\n"));
    const out = memory();

    createLogger(INFO, out).info({ config: parsed.config }, "config");

    const line = onlyLine(out);
    expect(JSON.parse(line).config.database.host).toBe("db.internal");
    expect(line).not.toContain(SENTINEL);
  });

  it.each([
    ["warn", ["warn", "error"]],
    ["error", ["error"]],
    ["debug", ["debug", "info", "warn", "error"]],
  ] as const)("writes only lines at or above level %s", (level, written) => {
    const out = memory();
    const logger = createLogger({ level, format: "json" }, out);

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");
    logger.error("error");

    expect(records(out).map((record) => record.msg)).toEqual(written);
  });
});
