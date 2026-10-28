import { MALFORMED_BODY } from "@closeout/contracts/schemas";
import {
  type DynamicModule,
  HttpStatus,
  type INestApplication,
  type NestApplicationOptions,
} from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { ErrorRequestHandler } from "express";
import { Logger, PinoLogger } from "nestjs-pino";
import type { DestinationStream } from "pino";
import { appModule } from "./app.module";
import type { AppConfig } from "./config/config";
import { createLogger } from "./logging/logger";
import { requestLogger } from "./logging/request-logger";
import { AppException } from "./problem/app-exception";
import { originCheck } from "./security/origin-check.middleware";
import { securityHeaders } from "./security/security-headers.middleware";

export interface AppSetup {
  module: DynamicModule;
  options: NestApplicationOptions;
  /** Registers the HTTP stages, in order; call before `init`/`listen`. */
  configure: (app: INestApplication) => void;
}

/**
 * How the server entry point and the integration tests boot the app: the
 * module, its creation options and the HTTP stages. The request id and
 * logger stage runs first, so requests refused by the origin check or the
 * body parser still get an id and a completion line. Nest logs through the
 * same logger from creation on, so boot lines, a failed database connection
 * included, are written in the configured format. `destination` replaces
 * stdout for log lines.
 */
export function appSetup(
  config: AppConfig,
  destination?: DestinationStream,
): AppSetup {
  const httpLogger = requestLogger(createLogger(config.logging, destination));
  const logger = new Logger(
    new PinoLogger({
      pinoHttp: { logger: httpLogger.logger },
      useExisting: true,
    }),
    {},
  );
  const { publicBaseUrl, internalSecret } = config.http;
  return {
    module: appModule(config, httpLogger.logger),
    options: { bodyParser: false, logger },
    configure: (app) => {
      const express = app as NestExpressApplication;
      express.disable("x-powered-by");
      express.use(httpLogger);
      express.use(securityHeaders);
      express.use(originCheck(publicBaseUrl, internalSecret));
      express.useBodyParser("json");
      express.useBodyParser("urlencoded", { extended: true });
      express.use(bodyParserFailures);
    },
  };
}

/**
 * Hands a malformed body to the problem filter as an app exception, keyed on
 * the parser's error type: left alone, the framework turns it into a 400
 * whose message echoes the body. Other parser failures (a body over the
 * limit) reach the filter as framework HTTP errors and get their status copy.
 */
const bodyParserFailures: ErrorRequestHandler = (err, _req, _res, next) => {
  const type = (err as { type?: unknown } | null)?.type;
  if (type === "entity.parse.failed") {
    next(new AppException(HttpStatus.BAD_REQUEST, MALFORMED_BODY));
    return;
  }
  next(err);
};
