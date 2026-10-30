import {
  type AcceptInviteRequest,
  acceptInviteRequestSchema,
  FORBIDDEN,
  type InviteDetails,
  type InviteLookupRequest,
  inviteLookupRequestSchema,
  NO_CLIENT_IP,
  type SessionResponse,
} from "@closeout/contracts/schemas";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  APP_CONFIG,
  type AppModuleConfig,
  internalSecret,
} from "@/config/config.module";
import type { Secret } from "@/config/secret";
import { AppException } from "@/problem/app-exception";
import {
  isInternalRequest,
  trustedClientIp,
} from "@/security/internal-request";
import { InvitesService } from "../services/invites.service";

/**
 * Called only by apps/web (the invite page and its accept route handler,
 * which owns the session cookie), with the visitor's IP for rate limiting.
 * The token travels in the body so it never lands in an access log path.
 */
@Controller("auth/invites")
export class InviteAcceptController {
  constructor(
    private readonly invites: InvitesService,
    @Inject(APP_CONFIG) private readonly config: AppModuleConfig,
  ) {}

  @Post("lookup")
  @HttpCode(200)
  lookup(
    @Req() req: Request,
    @Body({ schema: inviteLookupRequestSchema }) body: InviteLookupRequest,
  ): Promise<InviteDetails> {
    return this.invites.lookup(
      body.token,
      internalClientIp(req, internalSecret(this.config)),
    );
  }

  @Post("accept")
  @HttpCode(200)
  async accept(
    @Req() req: Request,
    @Body({ schema: acceptInviteRequestSchema }) body: AcceptInviteRequest,
  ): Promise<SessionResponse> {
    const { sessionToken, expiresAt } = await this.invites.accept(
      body,
      internalClientIp(req, internalSecret(this.config)),
    );
    return { sessionToken, expiresAt: expiresAt.toISOString() };
  }
}

function internalClientIp(req: Request, secret: Secret): string {
  if (!isInternalRequest(req.headers, secret)) {
    throw new AppException(HttpStatus.FORBIDDEN, FORBIDDEN);
  }
  // Without the visitor's IP every attempt would share one rate-limit
  // bucket, letting anyone lock invitees out.
  const clientIp = trustedClientIp(req.headers, secret);
  if (!clientIp) throw new AppException(HttpStatus.BAD_REQUEST, NO_CLIENT_IP);
  return clientIp;
}
