import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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
import { CreateInviteDto } from "../dto/invite.dto";
import {
  type InviteSummary,
  InvitesService,
  type IssuedInvite,
} from "../services/invites.service";

@Controller("stores/:storeId/invites")
@UseGuards(SessionGuard, StoreMemberGuard)
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @Roles(MANAGERS)
  @HttpCode(201)
  create(
    @CurrentMember() member: MembershipContext,
    @Body() body: CreateInviteDto,
  ): Promise<IssuedInvite> {
    return this.invites.create(member, body.email, body.role);
  }

  @Get()
  @Roles(MANAGERS)
  async list(
    @CurrentMember() member: MembershipContext,
  ): Promise<{ items: InviteSummary[] }> {
    return { items: await this.invites.list(member.storeId) };
  }

  @Delete(":id")
  @Roles(MANAGERS)
  @HttpCode(204)
  revoke(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.invites.revoke(member, id);
  }

  @Post(":id/regenerate")
  @Roles(MANAGERS)
  @HttpCode(200)
  regenerate(
    @CurrentMember() member: MembershipContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<IssuedInvite> {
    return this.invites.regenerate(member, id);
  }
}
