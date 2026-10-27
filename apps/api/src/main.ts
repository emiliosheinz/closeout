import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./configure-app";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks([], { useProcessExit: true });

  if (!process.env.PORT || !process.env.HOST) {
    throw new Error("PORT and HOST must be defined in environment variables");
  }

  await app.listen(process.env.PORT, process.env.HOST);
  new Logger("Bootstrap").log(
    `API listening on http://${process.env.HOST}:${process.env.PORT}`,
  );
}
bootstrap();
