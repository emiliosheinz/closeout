import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { originCheck } from "./security/origin-check.middleware";
import { securityHeaders } from "./security/security-headers.middleware";

const MIN_INTERNAL_SECRET_LENGTH = 32;

/** HTTP-level setup shared by the server entry point and integration tests. */
export function configureApp(app: INestApplication): void {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) throw new Error("PUBLIC_BASE_URL must be set");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET must be set");
  if (secret.length < MIN_INTERNAL_SECRET_LENGTH) {
    throw new Error(
      `INTERNAL_API_SECRET must be at least ${MIN_INTERNAL_SECRET_LENGTH} characters`,
    );
  }

  const express = app as NestExpressApplication;
  express.disable("x-powered-by");
  express.use(securityHeaders);
  express.use(originCheck(publicBaseUrl));
}
