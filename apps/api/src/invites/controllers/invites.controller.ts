import {
  type InviteRequest,
  type IssuedInvite,
  inviteRequestSchema,
  type PendingInvite,
  uuidSchema,
} from "@closeout/contracts/schemas";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { StoreMemberGuard } from "@/stores/guards/store-member.guard";
import {
  CurrentMember,
  MANAGERS,
  type MembershipContext,
  Roles,
} from "@/stores/membership";
import { InvitesService } from "../services/invites.service";

@Controller("stores/:storeId/invites")
@UseGuards(SessionGuard, StoreMemberGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @Roles(MANAGERS)
  @HttpCode(201)
  create(
    @CurrentMember() member: MembershipContext,
    @Body({ schema: inviteRequestSchema }) body: InviteRequest,
  ): Promise<IssuedInvite> {
    return this.invites.create(member, body.email, body.role);
  }

  @Get()
  @Roles(MANAGERS)
  async list(
    @CurrentMember() member: MembershipContext,
  ): Promise<{ items: PendingInvite[] }> {
    return { items: await this.invites.list(member.storeId) };
  }

  @Delete(":id")
  @Roles(MANAGERS)
  @HttpCode(204)
  revoke(
    @CurrentMember() member: MembershipContext,
    @Param("id", { schema: uuidSchema }) id: string,
  ): Promise<void> {
    return this.invites.revoke(member, id);
  }

  @Post(":id/regenerate")
  @Roles(MANAGERS)
  @HttpCode(200)
  regenerate(
    @CurrentMember() member: MembershipContext,
    @Param("id", { schema: uuidSchema }) id: string,
  ): Promise<IssuedInvite> {
    return this.invites.regenerate(member, id);
  }
}
