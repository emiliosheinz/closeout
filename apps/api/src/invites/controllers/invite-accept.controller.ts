import {
  type AcceptInviteRequest,
  acceptInviteRequestSchema,
  type InviteDetails,
  type InviteLookupRequest,
  inviteLookupRequestSchema,
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
import { InvitesService } from "../services/invites.service";

/**
 * Called only by apps/web (the invite page and its accept route handler,
 * which owns the session cookie), with the visitor's IP for rate limiting.
 * The token travels in the body so it never lands in an access log path.
 */
@UseGuards(InternalRequestGuard)
@Controller("auth/invites")
export class InviteAcceptController {
  constructor(private readonly invites: InvitesService) {}

  @Post("lookup")
  @HttpCode(200)
  lookup(
    @Req() req: RequestWithClientIp,
    @Body({ schema: inviteLookupRequestSchema }) body: InviteLookupRequest,
  ): Promise<InviteDetails> {
    return this.invites.lookup(body.token, requireClientIp(req));
  }

  @Post("accept")
  @HttpCode(200)
  async accept(
    @Req() req: RequestWithClientIp,
    @Body({ schema: acceptInviteRequestSchema }) body: AcceptInviteRequest,
  ): Promise<SessionResponse> {
    const { sessionToken, expiresAt } = await this.invites.accept(
      body,
      requireClientIp(req),
    );
    return { sessionToken, expiresAt: expiresAt.toISOString() };
  }
}
