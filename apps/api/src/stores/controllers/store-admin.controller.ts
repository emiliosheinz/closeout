import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { UpdateStoreDto } from "../dto/update-store.dto";
import { StoreMemberGuard } from "../guards/store-member.guard";
import {
  type CategoryResponse,
  type StoreSettings,
  StoresService,
} from "../services/stores.service";

@Controller("stores/:storeId")
@UseGuards(SessionGuard, StoreMemberGuard)
export class StoreAdminController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  get(@Param("storeId") storeId: string): Promise<StoreSettings> {
    return this.stores.getSettings(storeId);
  }

  @Patch()
  update(
    @Param("storeId") storeId: string,
    @Body() body: UpdateStoreDto,
  ): Promise<StoreSettings> {
    return this.stores.updateSettings(storeId, body);
  }

  @Get("categories")
  async categories(
    @Param("storeId") storeId: string,
  ): Promise<{ items: CategoryResponse[] }> {
    return { items: await this.stores.listCategories(storeId) };
  }
}
