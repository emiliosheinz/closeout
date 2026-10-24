import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "@/auth/guards/session.guard";
import { UpdateMemberDto } from "../dto/update-member.dto";
import { StoreMemberGuard } from "../guards/store-member.guard";
import {
  CurrentMember,
  MANAGERS,
  type MembershipContext,
  Roles,
} from "../membership";
import { type TeamMember, TeamService } from "../services/team.service";

@Controller("stores/:storeId/members")
@UseGuards(SessionGuard, StoreMemberGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @Roles(MANAGERS)
  async list(
    @CurrentMember() member: MembershipContext,
  ): Promise<{ items: TeamMember[] }> {
    return { items: await this.team.list(member.storeId) };
  }

  @Patch(":userId")
  @Roles(MANAGERS)
  changeRole(
    @CurrentMember() member: MembershipContext,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<TeamMember> {
    return this.team.changeRole(member, userId, body.role);
  }

  @Delete(":userId")
  @Roles(MANAGERS)
  @HttpCode(204)
  remove(
    @CurrentMember() member: MembershipContext,
    @Param("userId", new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    return this.team.remove(member, userId);
  }
}
