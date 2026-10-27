import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppModuleConfig } from "@/config/config.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MEDIA_STORAGE } from "./media-storage";
import { mediaStorageFor } from "./media-storage-config";

@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_STORAGE,
      inject: [APP_CONFIG],
      useFactory: (config: AppModuleConfig) => mediaStorageFor(config.media),
    },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
