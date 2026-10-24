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
  imageUploadOptions,
  MAX_FILES_PER_REQUEST,
} from "@/media/upload-limits";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  ANY_MEMBER,
  CurrentMember,
  type MembershipContext,
  Roles,
} from "@/stores/membership";
import {
  AdminListingsQueryDto,
  CreateListingDto,
  ListingStatusDto,
  ReorderImagesDto,
  UpdateListingDto,
} from "../dto/listing.dto";
import { AssignedListingGuard } from "../guards/assigned-listing.guard";
import type { PublicListingDetail } from "../public-mappers";
import { ListingImagesService } from "../services/listing-images.service";
import {
  type AdminImage,
  type AdminListingDetail,
  type AdminListingSummary,
  ListingsService,
} from "../services/listings.service";

@Controller("stores/:storeId/listings")
@UseGuards(SessionGuard, StoreMemberGuard, AssignedListingGuard)
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly images: ListingImagesService,
  ) {}

  @Get()
  @Roles(ANY_MEMBER)
  async list(
    @CurrentMember() member: MembershipContext,
    @Query() query: AdminListingsQueryDto,
  ): Promise<{ items: AdminListingSummary[] }> {
    return { items: await this.listings.list(member, query.q) };
  }

  @Post()
  @Roles(ANY_MEMBER)
  @HttpCode(201)
  create(
    @CurrentMember() member: MembershipContext,
    @Body() body: CreateListingDto,
  ): Promise<AdminListingDetail> {
    return this.listings.create(member, body);
  }

  @Get(":id")
  @Roles(ANY_MEMBER)
  get(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<AdminListingDetail> {
    return this.listings.get(member.storeId, id);
  }

  @Get(":id/preview")
  @Roles(ANY_MEMBER)
  preview(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<PublicListingDetail> {
    return this.listings.preview(member.storeId, id);
  }

  @Patch(":id")
  @Roles(ANY_MEMBER)
  update(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateListingDto,
  ): Promise<AdminListingDetail> {
    return this.listings.update(member, id, body);
  }

  @Patch(":id/status")
  @Roles(ANY_MEMBER)
  setStatus(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ListingStatusDto,
  ): Promise<AdminListingDetail> {
    return this.listings.update(member, id, body);
  }

  @Post(":id/duplicate")
  @Roles(ANY_MEMBER)
  @HttpCode(201)
  duplicate(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<AdminListingDetail> {
    return this.listings.duplicate(member.storeId, id);
  }

  @Delete(":id")
  @Roles(ANY_MEMBER)
  @HttpCode(204)
  remove(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.listings.remove(member.storeId, id);
  }

  @Post(":id/images")
  @Roles(ANY_MEMBER)
  @HttpCode(201)
  @UseFilters(new UploadErrorsFilter(TOO_MANY_PHOTOS))
  @UseInterceptors(
    FilesInterceptor(
      "files",
      MAX_FILES_PER_REQUEST,
      imageUploadOptions(MAX_FILES_PER_REQUEST),
    ),
  )
  async addImages(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<{ items: AdminImage[] }> {
    if (!files || files.length === 0) {
      throw new BadRequestException("Envie ao menos uma foto.");
    }
    try {
      const items = await this.images.add(
        member.storeId,
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
  @Roles(ANY_MEMBER)
  async reorderImages(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ReorderImagesDto,
  ): Promise<{ items: AdminImage[] }> {
    return { items: await this.images.reorder(member.storeId, id, body.ids) };
  }

  @Delete(":id/images/:imageId")
  @Roles(ANY_MEMBER)
  async removeImage(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
  ): Promise<{ items: AdminImage[] }> {
    return { items: await this.images.remove(member.storeId, id, imageId) };
  }
}
