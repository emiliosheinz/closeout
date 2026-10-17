import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  type DashboardCounts,
  ListingsService,
} from "../services/listings.service";

@Controller("stores/:storeId/dashboard")
@UseGuards(SessionGuard, StoreMemberGuard)
export class DashboardController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  dashboard(@Param("storeId") storeId: string): Promise<DashboardCounts> {
    return this.listings.dashboard(storeId);
  }
}
