import type { Me } from "@closeout/contracts/schemas";
import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  type RequestWithPrincipal,
  requirePrincipal,
  SessionGuard,
} from "@/auth/guards/session.guard";
import { StoresService } from "../services/stores.service";

@Controller("me")
export class MeController {
  constructor(private readonly stores: StoresService) {}

  @UseGuards(SessionGuard)
  @Get()
  me(@Req() req: RequestWithPrincipal): Promise<Me> {
    return this.stores.me(requirePrincipal(req).userId);
  }
}
