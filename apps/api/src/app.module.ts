import { type DynamicModule, Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { type AppModuleConfig, configModule } from "./config/config.module";
import { dataSourceOptions } from "./database/connection";
import { InvitesModule } from "./invites/invites.module";
import { MediaModule } from "./media/media.module";
import { SellersModule } from "./sellers/sellers.module";
import { StoresModule } from "./stores/stores.module";

@Module({
  imports: [
    AuthModule,
    StoresModule,
    SellersModule,
    MediaModule,
    CatalogModule,
    InvitesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}

/** The app module wired to the entry point's parsed config. */
export function appModule(config: AppModuleConfig): DynamicModule {
  return {
    module: AppModule,
    imports: [
      configModule(config),
      TypeOrmModule.forRoot(dataSourceOptions(config.database)),
    ],
  };
}
