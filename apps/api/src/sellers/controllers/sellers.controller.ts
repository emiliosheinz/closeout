import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { InvalidImageError } from "@/media/image-processor";
import {
  ONE_PHOTO_AT_A_TIME,
  UploadErrorsFilter,
} from "@/media/upload-errors.filter";
import { imageUploadOptions } from "@/media/upload-limits";
import { AppException } from "@/problem/app-exception";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  ANY_MEMBER,
  CurrentMember,
  type MembershipContext,
  Roles,
} from "@/stores/membership";
import { UpdateSellerDto } from "../dto/seller.dto";
import {
  type SellerResponse,
  SellersService,
} from "../services/sellers.service";

const NO_IMAGE = "Envie uma imagem.";

/**
 * Contact profiles are created and deleted only with their member (see the
 * team endpoints); here they are listed and edited.
 */
@Controller("stores/:storeId/sellers")
@UseGuards(SessionGuard, StoreMemberGuard)
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  @Roles(ANY_MEMBER)
  async list(
    @CurrentMember() member: MembershipContext,
  ): Promise<{ items: SellerResponse[] }> {
    return { items: await this.sellers.list(member.storeId) };
  }

  @Patch(":id")
  @Roles(ANY_MEMBER)
  update(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSellerDto,
  ): Promise<SellerResponse> {
    return this.sellers.update(member, id, body);
  }

  @Post(":id/avatar")
  @Roles(ANY_MEMBER)
  @UseFilters(new UploadErrorsFilter(ONE_PHOTO_AT_A_TIME))
  @UseInterceptors(FileInterceptor("file", imageUploadOptions(1)))
  async avatar(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<SellerResponse> {
    if (!file) throw new AppException(HttpStatus.BAD_REQUEST, NO_IMAGE);
    try {
      return await this.sellers.setAvatar(member, id, file.buffer);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        throw new AppException(HttpStatus.BAD_REQUEST, err.message);
      }
      throw err;
    }
  }
}
