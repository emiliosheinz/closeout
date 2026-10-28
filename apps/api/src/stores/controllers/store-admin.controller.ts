import {
  type StoreRequest,
  storeRequestSchema,
  uuidSchema,
} from "@closeout/contracts/schemas";
import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "../guards/store-member.guard";
import { ANY_MEMBER, MANAGERS, Roles } from "../membership";
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
  @Roles(ANY_MEMBER)
  get(
    @Param("storeId", { schema: uuidSchema }) storeId: string,
  ): Promise<StoreSettings> {
    return this.stores.getSettings(storeId);
  }

  @Patch()
  @Roles(MANAGERS)
  update(
    @Param("storeId", { schema: uuidSchema }) storeId: string,
    @Body({ schema: storeRequestSchema }) body: StoreRequest,
  ): Promise<StoreSettings> {
    return this.stores.updateSettings(storeId, body);
  }

  @Get("categories")
  @Roles(ANY_MEMBER)
  async categories(
    @Param("storeId", { schema: uuidSchema }) storeId: string,
  ): Promise<{ items: CategoryResponse[] }> {
    return { items: await this.stores.listCategories(storeId) };
  }
}
