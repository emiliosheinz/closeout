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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SessionGuard } from "@/auth/guards/session.guard";
import { InvalidImageError } from "@/media/image-processor";
import { IMAGE_UPLOAD_OPTIONS } from "@/media/upload-limits";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import { CreateSellerDto, UpdateSellerDto } from "../dto/seller.dto";
import {
  type SellerResponse,
  SellersService,
} from "../services/sellers.service";

@Controller("stores/:storeId/sellers")
@UseGuards(SessionGuard, StoreMemberGuard)
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  async list(
    @Param("storeId") storeId: string,
  ): Promise<{ items: SellerResponse[] }> {
    return { items: await this.sellers.list(storeId) };
  }

  @Post()
  @HttpCode(201)
  create(
    @Param("storeId") storeId: string,
    @Body() body: CreateSellerDto,
  ): Promise<SellerResponse> {
    return this.sellers.create(storeId, body);
  }

  @Patch(":id")
  update(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateSellerDto,
  ): Promise<SellerResponse> {
    return this.sellers.update(storeId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.sellers.remove(storeId, id);
  }

  @Post(":id/avatar")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD_OPTIONS))
  async avatar(
    @Param("storeId") storeId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<SellerResponse> {
    if (!file) throw new BadRequestException("Envie uma imagem.");
    try {
      return await this.sellers.setAvatar(storeId, id, file.buffer);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }
}
