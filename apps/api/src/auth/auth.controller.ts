import {
  FORBIDDEN,
  type LoginRequest,
  loginRequestSchema,
  NO_CLIENT_IP,
} from "@closeout/contracts/schemas";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import {
  APP_CONFIG,
  type AppModuleConfig,
  internalSecret,
} from "@/config/config.module";
import { AppException } from "@/problem/app-exception";
import {
  isInternalRequest,
  trustedClientIp,
} from "@/security/internal-request";
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
    @Inject(APP_CONFIG) private readonly config: AppModuleConfig,
  ) {}

  /**
   * Called only by the apps/web login route handler, which owns the session
   * cookie and forwards the visitor's IP for rate limiting.
   */
  @Post("login")
  @HttpCode(200)
  async login(
    @Req() req: Request,
    @Body({ schema: loginRequestSchema }) body: LoginRequest,
  ): Promise<{ sessionToken: string; expiresAt: string }> {
    const secret = internalSecret(this.config);
    if (!isInternalRequest(req.headers, secret)) {
      throw new AppException(HttpStatus.FORBIDDEN, FORBIDDEN);
    }
    // Without the visitor's IP every attempt would share one rate-limit
    // bucket, letting anyone lock the admins out.
    const clientIp = trustedClientIp(req.headers, secret);
    if (!clientIp) {
      throw new AppException(HttpStatus.BAD_REQUEST, NO_CLIENT_IP);
    }
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
