import {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
  pino,
} from "pino";
import type { LogLevel } from "@/config/config";
import { REDACTED_PATHS, serializers } from "./serializers";

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
  };
  if (destination) return pino(options, destination);
  if (process.env.NODE_ENV === "production") return pino(options);
  // pino-pretty is a dev dependency: resolved only outside production.
  return pino({ ...options, transport: { target: "pino-pretty" } });
}
