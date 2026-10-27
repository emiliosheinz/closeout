import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { HttpConfig } from "./config/config";
import { originCheck } from "./security/origin-check.middleware";
import { securityHeaders } from "./security/security-headers.middleware";

/** HTTP-level setup shared by the server entry point and integration tests. */
export function configureApp(
  app: INestApplication,
  { publicBaseUrl, internalSecret }: HttpConfig,
): void {
  const express = app as NestExpressApplication;
  express.disable("x-powered-by");
  express.use(securityHeaders);
  express.use(originCheck(publicBaseUrl, internalSecret));
}
