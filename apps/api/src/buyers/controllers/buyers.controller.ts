import type { BuyerSummary } from "@closeout/contracts/schemas";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  ANY_MEMBER,
  CurrentMember,
  type MembershipContext,
  Roles,
} from "@/stores/membership";
import { BuyersService } from "../services/buyers.service";

@Controller("stores/:storeId/buyers")
@UseGuards(SessionGuard, StoreMemberGuard)
export class BuyersController {
  constructor(private readonly buyers: BuyersService) {}

  @Get()
  @Roles(ANY_MEMBER)
  async list(
    @CurrentMember() member: MembershipContext,
  ): Promise<{ items: BuyerSummary[] }> {
    return { items: await this.buyers.list(member) };
  }
}
