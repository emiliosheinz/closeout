import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  type RequestWithPrincipal,
  requirePrincipal,
  SessionGuard,
} from "@/auth/guards/session.guard";
import { type MeResponse, StoresService } from "../services/stores.service";

@Controller("me")
export class MeController {
  constructor(private readonly stores: StoresService) {}

  @UseGuards(SessionGuard)
  @Get()
  me(@Req() req: RequestWithPrincipal): Promise<MeResponse> {
    return this.stores.me(requirePrincipal(req).userId);
  }
}
