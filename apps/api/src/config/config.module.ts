import { type DynamicModule, Module } from "@nestjs/common";
import type { AppConfig, CliConfig } from "./config";
import type { Secret } from "./secret";

/**
 * What the app module reads. The operator CLI boots it with its own scope,
 * which has no port, host or internal secret; no provider reads those while
 * being constructed.
 */
export type AppModuleConfig = AppConfig | CliConfig;

export const APP_CONFIG = Symbol("APP_CONFIG");

@Module({})
export class ConfigModule {}

/** Provides the entry point's parsed config to every module. */
export function configModule(config: AppModuleConfig): DynamicModule {
  return {
    module: ConfigModule,
    global: true,
    providers: [{ provide: APP_CONFIG, useValue: config }],
    exports: [APP_CONFIG],
  };
}

/** Only the server carries the internal secret: it is read per request. */
export function internalSecret(config: AppModuleConfig): Secret {
  if (!("internalSecret" in config.http)) {
    throw new Error("The internal secret is read only by the server");
  }
  return config.http.internalSecret;
}
