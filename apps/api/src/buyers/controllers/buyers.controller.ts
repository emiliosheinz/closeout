import {
  type Buyer,
  type BuyerMergeRequest,
  type BuyerSummary,
  type BuyerUpdateRequest,
  buyerMergeRequestSchema,
  buyerUpdateRequestSchema,
  uuidSchema,
} from "@closeout/contracts/schemas";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
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

  @Patch(":id")
  @Roles(ANY_MEMBER)
  update(
    @CurrentMember() member: MembershipContext,
    @Param("id", { schema: uuidSchema }) id: string,
    @Body({ schema: buyerUpdateRequestSchema }) body: BuyerUpdateRequest,
  ): Promise<Buyer> {
    return this.buyers.update(member.storeId, id, body);
  }

  @Delete(":id")
  @Roles(ANY_MEMBER)
  @HttpCode(204)
  remove(
    @CurrentMember() member: MembershipContext,
    @Param("id", { schema: uuidSchema }) id: string,
  ): Promise<void> {
    return this.buyers.remove(member.storeId, id);
  }

  @Post(":id/merge")
  @Roles(ANY_MEMBER)
  merge(
    @CurrentMember() member: MembershipContext,
    @Param("id", { schema: uuidSchema }) id: string,
    @Body({ schema: buyerMergeRequestSchema }) body: BuyerMergeRequest,
  ): Promise<Buyer> {
    return this.buyers.merge(member.storeId, id, body.targetId);
  }
}
