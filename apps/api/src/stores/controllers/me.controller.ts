import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import {
  type RequestWithPrincipal,
  requirePrincipal,
  SessionGuard,
} from "@/auth/guards/session.guard";
import { type Membership, StoresService } from "../services/stores.service";

interface MeResponse {
  user: { id: string; name: string; email: string };
  memberships: Membership[];
}

@Controller("me")
export class MeController {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly stores: StoresService,
  ) {}

  @UseGuards(SessionGuard)
  @Get()
  async me(@Req() req: RequestWithPrincipal): Promise<MeResponse> {
    const { userId } = requirePrincipal(req);
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    return {
      user: { id: user.id, name: user.name, email: user.email },
      memberships: await this.stores.membershipsFor(userId),
    };
  }
}
