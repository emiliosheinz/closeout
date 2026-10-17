import { Module } from "@nestjs/common";
import { LocalDiskStorage } from "./local-disk-storage";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MEDIA_STORAGE } from "./media-storage";

@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: MEDIA_STORAGE,
      useFactory: () => {
        const root = process.env.MEDIA_DIR;
        if (!root) throw new Error("MEDIA_DIR must be set");
        return new LocalDiskStorage(root);
      },
    },
    MediaService,
  ],
  exports: [MediaService],
})
export class MediaModule {}
