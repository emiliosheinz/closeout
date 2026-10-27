import type {
  DynamicModule,
  INestApplication,
  NestApplicationOptions,
} from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import type { DestinationStream } from "pino";
import { appModule } from "./app.module";
import type { AppConfig } from "./config/config";
import { createLogger } from "./logging/logger";
import { requestLogger } from "./logging/request-logger";
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
 * body parser still get an id and a completion line. `destination` replaces
 * stdout for log lines.
 */
export function appSetup(
  config: AppConfig,
  destination?: DestinationStream,
): AppSetup {
  const httpLogger = requestLogger(createLogger(config.logging, destination));
  const { publicBaseUrl, internalSecret } = config.http;
  return {
    module: appModule(config, httpLogger.logger),
    options: { bodyParser: false, bufferLogs: true },
    configure: (app) => {
      const express = app as NestExpressApplication;
      express.disable("x-powered-by");
      express.use(httpLogger);
      express.use(securityHeaders);
      express.use(originCheck(publicBaseUrl, internalSecret));
      express.useBodyParser("json");
      express.useBodyParser("urlencoded", { extended: true });
      app.useLogger(app.get(Logger));
    },
  };
}
