import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { MediaService } from "./media.service";
import { MEDIA_FILE_PATTERN } from "./media-storage";

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(":file")
  async serve(
    @Param("file") file: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!MEDIA_FILE_PATTERN.test(file)) throw new NotFoundException();
    const data = await this.media.read(file);
    if (!data) throw new NotFoundException();

    res.setHeader(
      "Content-Type",
      file.endsWith(".jpg") ? "image/jpeg" : "image/webp",
    );
    // Names are random per upload and never reused, so they can be cached
    // forever.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(data);
  }
}
