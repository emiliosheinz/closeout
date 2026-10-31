import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { TooManyAttempts } from "@/problem/too-many-attempts";
import {
  type RequestWithClientIp,
  requireClientIp,
} from "@/security/internal-request.guard";
import { SlidingWindowCounter } from "@/security/sliding-window";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 20;

/**
 * Limits signup attempts per client IP. Every attempt counts, valid or not;
 * a refused one does not, so retrying never extends the wait. Runs after the
 * internal guard, which attaches the IP.
 */
@Injectable()
export class WaitlistSignupRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(WaitlistSignupRateLimitGuard.name);
  private readonly attempts = new SlidingWindowCounter(WINDOW_MS);

  canActivate(context: ExecutionContext): boolean {
    const ip = requireClientIp(
      context.switchToHttp().getRequest<RequestWithClientIp>(),
    );
    const now = Date.now();
    if (this.attempts.count(ip, now) >= MAX_ATTEMPTS) {
      this.logger.warn({ ip }, "Waitlist signups rate limited");
      throw new TooManyAttempts(this.attempts.retryAfterSeconds(ip, now));
    }
    this.attempts.record(ip, now);
    return true;
  }
}
