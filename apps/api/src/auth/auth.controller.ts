import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  isInternalRequest,
  trustedClientIp,
} from "@/security/internal-request";
import { LoginDto } from "./dto/login.dto";
import {
  type RequestWithPrincipal,
  requirePrincipal,
  SessionGuard,
} from "./guards/session.guard";
import { AuthService } from "./services/auth.service";
import { SessionsService } from "./services/sessions.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Called only by the apps/web login route handler, which owns the session
   * cookie and forwards the visitor's IP for rate limiting.
   */
  @Post("login")
  @HttpCode(200)
  async login(
    @Req() req: Request,
    @Body() body: LoginDto,
  ): Promise<{ sessionToken: string; expiresAt: string }> {
    if (!isInternalRequest(req.headers)) throw new ForbiddenException();
    // Without the visitor's IP every attempt would share one rate-limit
    // bucket, letting anyone lock the admins out.
    const clientIp = trustedClientIp(req.headers);
    if (!clientIp) throw new BadRequestException("Missing client IP");
    const { sessionToken, expiresAt } = await this.auth.login(
      body.email,
      body.password,
      clientIp,
    );
    return { sessionToken, expiresAt: expiresAt.toISOString() };
  }

  @UseGuards(SessionGuard)
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: RequestWithPrincipal): Promise<void> {
    await this.sessions.revoke(requirePrincipal(req).sessionId);
  }
}
