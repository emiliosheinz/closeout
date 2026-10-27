import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { serverScope } from "./config/config";
import { parseOrExit } from "./config/report";
import { appSetup } from "./configure-app";

async function bootstrap() {
  const config = parseOrExit(serverScope);
  const setup = appSetup(config);
  const app = await NestFactory.create(setup.module, setup.options);
  setup.configure(app);
  app.enableShutdownHooks([], { useProcessExit: true });

  const { port, host } = config.http;
  await app.listen(port, host);
  new Logger("Bootstrap").log(`API listening on http://${host}:${port}`);
}
bootstrap();
