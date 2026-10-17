import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";

/** HTTP-level setup shared by the server entry point and integration tests. */
export function configureApp(app: INestApplication): void {
  (app as NestExpressApplication).disable("x-powered-by");
}
