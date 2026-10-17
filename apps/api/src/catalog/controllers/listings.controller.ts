import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { InvalidImageError } from "@/media/image-processor";
import {
  TOO_MANY_PHOTOS,
  UploadErrorsFilter,
} from "@/media/upload-errors.filter";
import {
  IMAGE_UPLOAD_OPTIONS,
  MAX_FILES_PER_REQUEST,
} from "@/media/upload-limits";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  AdminListingsQueryDto,
  CreateListingDto,
  ListingStatusDto,
  ReorderImagesDto,
  UpdateListingDto,
} from "../dto/listing.dto";
import type { PublicListingDetail } from "../public-mappers";
import { ListingImagesService } from "../services/listing-images.service";
import {
  type AdminImage,
  type AdminListingDetail,
  type AdminListingSummary,
  ListingsService,
} from "../services/listings.service";

@Controller("stores/:storeId/listings")
@UseGuards(SessionGuard, StoreMemberGuard)
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly images: ListingImagesService,
  ) {}

  @Get()
  async list(
    @Param("storeId") storeId: string,
    @Query() query: AdminListingsQueryDto,
  ): Promise<{ items: AdminListingSummary[] }> {
    return { items: await this.listings.list(storeId, query.q) };
  }

  @Post()
  @HttpCode(201)
  create(
    @Param("storeId") storeId: string,
    @Body() body: CreateListingDto,
  ): Promise<AdminListingDetail> {
    return this.listings.create(storeId, body);
  }

  @Get(":id")
  get(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<AdminListingDetail> {
    return this.listings.get(storeId, id);
  }

  @Get(":id/preview")
  preview(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<PublicListingDetail> {
    return this.listings.preview(storeId, id);
  }

  @Patch(":id")
  update(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateListingDto,
  ): Promise<AdminListingDetail> {
    return this.listings.update(storeId, id, body);
  }

  @Patch(":id/status")
  setStatus(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ListingStatusDto,
  ): Promise<AdminListingDetail> {
    return this.listings.update(storeId, id, body);
  }

  @Post(":id/duplicate")
  @HttpCode(201)
  duplicate(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<AdminListingDetail> {
    return this.listings.duplicate(storeId, id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.listings.remove(storeId, id);
  }

  @Post(":id/images")
  @HttpCode(201)
  @UseFilters(new UploadErrorsFilter(TOO_MANY_PHOTOS))
  @UseInterceptors(
    FilesInterceptor("files", MAX_FILES_PER_REQUEST, IMAGE_UPLOAD_OPTIONS),
  )
  async addImages(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<{ items: AdminImage[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException("Envie ao menos uma foto.");
    }
    try {
      const items = await this.images.add(
        storeId,
        id,
        files.map((file) => file.buffer),
      );
      return { items };
    } catch (err) {
      if (err instanceof InvalidImageError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  @Put(":id/images/order")
  async reorderImages(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ReorderImagesDto,
  ): Promise<{ items: AdminImage[] }> {
    return { items: await this.images.reorder(storeId, id, body.ids) };
  }

  @Delete(":id/images/:imageId")
  async removeImage(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ): Promise<{ items: AdminImage[] }> {
    return { items: await this.images.remove(storeId, id, imageId) };
  }
}
