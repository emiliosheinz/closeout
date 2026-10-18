import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MEDIA_STORAGE } from "./media-storage";
import { mediaStorageFromEnv } from "./media-storage-config";

@Module({
  controllers: [MediaController],
  providers: [
    { provide: MEDIA_STORAGE, useFactory: () => mediaStorageFromEnv() },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
