import {
  type WaitlistSignupRequest,
  waitlistSignupRequestSchema,
} from "@closeout/contracts/schemas";
import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { InternalRequestGuard } from "@/security/internal-request.guard";
import { WaitlistSignupRateLimitGuard } from "../guards/waitlist-signup-rate-limit.guard";
import { WaitlistService } from "../services/waitlist.service";

/** Called only by apps/web's signup relay, with the visitor's IP. */
@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post("signups")
  @HttpCode(204)
  @UseGuards(InternalRequestGuard, WaitlistSignupRateLimitGuard)
  signup(
    @Body({ schema: waitlistSignupRequestSchema }) body: WaitlistSignupRequest,
  ): Promise<void> {
    return this.waitlist.signup(body);
  }
}
