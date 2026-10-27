import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { serializers } from "./serializers";

const REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

function pathOf(req: IncomingMessage): string {
  return (req.url ?? "").split("?")[0] ?? "";
}

/**
 * Gives every request an id (a valid incoming `x-request-id`, else a new
 * one), echoes it on the response, binds it as `reqId` to every line logged
 * while handling the request and writes one completion line, except for
 * health checks.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    serializers,
    wrapSerializers: false,
    quietReqLogger: true,
    genReqId: (req, res) => {
      const incoming = req.headers["x-request-id"];
      const id =
        typeof incoming === "string" && REQUEST_ID.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    autoLogging: { ignore: (req) => pathOf(req) === "/health" },
  });
}
