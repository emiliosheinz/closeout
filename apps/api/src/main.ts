import { Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { serverScope } from "./config/config";
import { parseOrExit } from "./config/report";
import { appSetup } from "./configure-app";
import { shutdownTracing } from "./tracing";

/** Flushes pending spans on close, after the HTTP adapter has drained. */
@Module({})
class Server implements OnApplicationShutdown {
  onApplicationShutdown() {
    return shutdownTracing();
  }
}

async function bootstrap() {
  const config = parseOrExit(serverScope);
  const setup = appSetup(config);
  const app = await NestFactory.create(
    { module: Server, imports: [setup.module] },
    setup.options,
  );
  setup.configure(app);
  app.enableShutdownHooks([], { useProcessExit: true });

  const { port, host } = config.http;
  await app.listen(port, host);
  new Logger("Bootstrap").log({ host, port }, "API listening");
}
bootstrap();
