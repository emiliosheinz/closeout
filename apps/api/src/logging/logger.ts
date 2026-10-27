import {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
  pino,
} from "pino";
import type { LogLevel } from "@/config/config";
import { errorMessage, REDACTED_PATHS, serializers } from "./serializers";

/**
 * The process logger. JSON lines on stdout in production, pretty-printed
 * otherwise; `destination` replaces stdout (always JSON), which is how tests
 * capture lines in memory.
 */
export function createLogger(
  level: LogLevel,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    level,
    serializers,
    redact: { paths: REDACTED_PATHS },
    hooks: {
      logMethod(args, method) {
        const [first, second] = args as unknown[];
        const err =
          first instanceof Error ? first : (first as { err?: unknown })?.err;
        if (typeof second === "string" || !(err instanceof Error)) {
          return method.apply(this, args);
        }
        return method.call(this, first as object, errorMessage(err));
      },
    },
  };
  if (destination) return pino(options, destination);
  if (process.env.NODE_ENV === "production") return pino(options);
  // pino-pretty is a dev dependency: resolved only outside production.
  return pino({ ...options, transport: { target: "pino-pretty" } });
}
