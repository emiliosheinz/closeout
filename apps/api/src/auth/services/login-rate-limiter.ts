import { Injectable } from "@nestjs/common";
import { SlidingWindowCounter } from "@/security/sliding-window";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_CLIENT = 10;
const MAX_FAILURES_PER_EMAIL = 30;
const MAX_FAILURES_PER_IP = 30;

/**
 * Sliding-window limiter for failed logins, keyed by `email|ip` (stops a
 * single client guessing), by email alone (stops distributed guessing at a
 * higher threshold) and by IP alone (stops one host rotating emails).
 */
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new SlidingWindowCounter(WINDOW_MS);

  isBlocked(email: string, ip: string, now = Date.now()): boolean {
    return (
      this.failures.count(clientKey(email, ip), now) >=
        MAX_FAILURES_PER_CLIENT ||
      this.failures.count(emailKey(email), now) >= MAX_FAILURES_PER_EMAIL ||
      this.failures.count(ipKey(ip), now) >= MAX_FAILURES_PER_IP
    );
  }

  /**
   * Count an attempt as failed before the password is checked, so a burst
   * of concurrent requests cannot all slip past {@link isBlocked} while the
   * slow hash comparison runs. {@link forgiveSuccess} undoes it.
   */
  recordFailure(email: string, ip: string, now = Date.now()): void {
    for (const key of [clientKey(email, ip), emailKey(email), ipKey(ip)]) {
      this.failures.record(key, now);
    }
  }

  /** A successful login clears the client's counter and returns its attempt. */
  forgiveSuccess(email: string, ip: string, now = Date.now()): void {
    this.failures.clear(clientKey(email, ip));
    for (const key of [emailKey(email), ipKey(ip)]) {
      this.failures.forgetLatest(key, now);
    }
  }
}

function clientKey(email: string, ip: string): string {
  return `client:${email.toLowerCase()}|${ip}`;
}

function emailKey(email: string): string {
  return `email:${email.toLowerCase()}`;
}

function ipKey(ip: string): string {
  return `ip:${ip}`;
}
