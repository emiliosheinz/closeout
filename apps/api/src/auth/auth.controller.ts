import {
  type LoginRequest,
  loginRequestSchema,
  type SessionResponse,
} from "@closeout/contracts/schemas";
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  InternalRequestGuard,
  type RequestWithClientIp,
  requireClientIp,
} from "@/security/internal-request.guard";
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
  @UseGuards(InternalRequestGuard)
  @Post("login")
  @HttpCode(200)
  async login(
    @Req() req: RequestWithClientIp,
    @Body({ schema: loginRequestSchema }) body: LoginRequest,
  ): Promise<SessionResponse> {
    const { sessionToken, expiresAt } = await this.auth.login(
      body.email,
      body.password,
      requireClientIp(req),
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
