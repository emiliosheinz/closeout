import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Keys whose values never reach a log line, at any of the first three levels
 * of a logged object. A backstop: the serializers below already leave
 * headers and bodies out.
 */
const SECRET_KEYS = [
  "password",
  "token",
  "sessionToken",
  "link",
  "authorization",
  "cookie",
  "set-cookie",
  "x-internal-secret",
];

export const REDACTED_PATHS = SECRET_KEYS.flatMap((key) => {
  const property = `["${key}"]`;
  return [property, `*${property}`, `*.*${property}`];
});

interface Driver {
  code?: unknown;
  constraint?: unknown;
  table?: unknown;
}

/**
 * The driver error behind `err` (TypeORM's `driverError`), or `err` itself
 * when it is one (pg reports server errors with a `severity`). Its message
 * echoes bound values, so only its SQLSTATE code and the names of the
 * objects involved are logged.
 */
function driverErrorOf(err: Error): Driver | undefined {
  if ("driverError" in err && typeof err.driverError === "object") {
    return err.driverError ?? undefined;
  }
  if ("severity" in err && "code" in err) return err;
  return undefined;
}

/** Stack frames only: the stack's first line repeats the message. */
function framesOf(stack: string | undefined): string | undefined {
  return stack
    ?.split("\n")
    .filter((line) => /^\s+at /.test(line))
    .join("\n");
}

/**
 * The line message for an error logged without one: pino would otherwise
 * take the error's own message, driver text included.
 */
export function errorMessage(err: Error): string {
  return driverErrorOf(err) ? err.constructor.name : err.message;
}

/** Type, code and stack frames; the message only when no driver error is wrapped. */
export function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { type: typeof err };
  const stack = framesOf(err.stack);
  const type = err.constructor.name;
  const driver = driverErrorOf(err);
  if (driver) {
    const { code, constraint, table } = driver;
    return { type, code, constraint, table, stack };
  }
  const code = (err as { code?: unknown }).code;
  return { type, message: err.message, code, stack };
}

/** The request's path, without the query string. */
export function pathOf(
  req: IncomingMessage & { originalUrl?: string },
): string {
  return (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
}

/** Method, id and path: never headers or bodies. */
export function serializeRequest(
  req: IncomingMessage & { id?: unknown; originalUrl?: string },
): Record<string, unknown> {
  return { id: req.id, method: req.method, path: pathOf(req) };
}

export function serializeResponse(
  res: ServerResponse,
): Record<string, unknown> {
  return { statusCode: res.statusCode };
}

export const serializers = {
  err: serializeError,
  req: serializeRequest,
  res: serializeResponse,
};
