import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  ANY_MEMBER,
  CurrentMember,
  type MembershipContext,
  Roles,
} from "@/stores/membership";
import {
  type DashboardCounts,
  ListingsService,
} from "../services/listings.service";

@Controller("stores/:storeId/dashboard")
@UseGuards(SessionGuard, StoreMemberGuard)
export class DashboardController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @Roles(ANY_MEMBER)
  dashboard(
    @CurrentMember() member: MembershipContext,
  ): Promise<DashboardCounts> {
    return this.listings.dashboard(member);
  }
}
