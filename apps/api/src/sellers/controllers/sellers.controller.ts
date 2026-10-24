import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { UploadErrorsFilter } from "@/media/upload-errors.filter";
import { imageUploadOptions } from "@/media/upload-limits";
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
  @UseFilters(new UploadErrorsFilter("Envie uma foto por vez."))
  @UseInterceptors(FileInterceptor("file", imageUploadOptions(1)))
  async avatar(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<SellerResponse> {
    if (!file) throw new BadRequestException("Envie uma imagem.");
    try {
      return await this.sellers.setAvatar(member, id, file.buffer);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
