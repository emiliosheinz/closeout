import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  isInternalRequest,
  trustedClientIp,
} from "@/security/internal-request";
import { AcceptInviteDto, InviteTokenDto } from "../dto/invite.dto";
import {
  type InviteDetails,
  InvitesService,
} from "../services/invites.service";

/**
 * Called only by apps/web (the invite page and its accept route handler,
 * which owns the session cookie), with the visitor's IP for rate limiting.
 * The token travels in the body so it never lands in an access log path.
 */
@Controller("auth/invites")
export class InviteAcceptController {
  constructor(private readonly invites: InvitesService) {}

  @Post("lookup")
  @HttpCode(200)
  lookup(
    @Req() req: Request,
    @Body() body: InviteTokenDto,
  ): Promise<InviteDetails> {
    return this.invites.lookup(body.token, internalClientIp(req));
  }

  @Post("accept")
  @HttpCode(200)
  async accept(
    @Req() req: Request,
    @Body() body: AcceptInviteDto,
  ): Promise<{ sessionToken: string; expiresAt: string }> {
    const { sessionToken, expiresAt } = await this.invites.accept(
      body,
      internalClientIp(req),
    );
    return { sessionToken, expiresAt: expiresAt.toISOString() };
  }
}

function internalClientIp(req: Request): string {
  if (!isInternalRequest(req.headers)) throw new ForbiddenException();
  // Without the visitor's IP every attempt would share one rate-limit
  // bucket, letting anyone lock invitees out.
  const clientIp = trustedClientIp(req.headers);
  if (!clientIp) throw new BadRequestException("Missing client IP");
  return clientIp;
}
