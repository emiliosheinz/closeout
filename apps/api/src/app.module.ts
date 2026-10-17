import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { dataSourceOptions } from "./database/connection";
import { MediaModule } from "./media/media.module";
import { SellersModule } from "./sellers/sellers.module";
import { StoresModule } from "./stores/stores.module";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }),
    AuthModule,
    StoresModule,
    SellersModule,
    MediaModule,
    CatalogModule,
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
