import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { appModule } from "./app.module";
import { serverScope } from "./config/config";
import { parseOrExit } from "./config/report";
import { configureApp } from "./configure-app";

async function bootstrap() {
  const config = parseOrExit(serverScope);
  const app = await NestFactory.create(appModule(config));
  configureApp(app, config.http);
  app.enableShutdownHooks([], { useProcessExit: true });

  const { port, host } = config.http;
  await app.listen(port, host);
  new Logger("Bootstrap").log(`API listening on http://${host}:${port}`);
}
bootstrap();
