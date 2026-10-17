import { Injectable } from "@nestjs/common";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_CLIENT = 10;
const MAX_FAILURES_PER_EMAIL = 30;

/**
 * Sliding-window limiter for failed logins, keyed by `email|ip` (stops a
 * single client guessing) and by email alone (stops distributed guessing at
 * a higher threshold).
 *
 * ponytail: in-memory, so counters reset on restart and are not shared
 * between replicas. Move to a Postgres or Redis table before running more
 * than one API instance.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  isBlocked(email: string, ip: string, now = Date.now()): boolean {
    return (
      this.recent(clientKey(email, ip), now).length >=
        MAX_FAILURES_PER_CLIENT ||
      this.recent(emailKey(email), now).length >= MAX_FAILURES_PER_EMAIL
    );
  }

  /**
   * Count an attempt as failed before the password is checked, so a burst
   * of concurrent requests cannot all slip past {@link isBlocked} while the
   * slow hash comparison runs. {@link forgiveSuccess} undoes it.
   */
  recordFailure(email: string, ip: string, now = Date.now()): void {
    this.sweep(now);
    for (const key of [clientKey(email, ip), emailKey(email)]) {
      this.failures.set(key, [...this.recent(key, now), now]);
    }
  }

  /** A successful login clears the client's counter and returns its attempt. */
  forgiveSuccess(email: string, ip: string, now = Date.now()): void {
    this.failures.delete(clientKey(email, ip));
    const remaining = this.recent(emailKey(email), now).slice(0, -1);
    if (remaining.length > 0) this.failures.set(emailKey(email), remaining);
    else this.failures.delete(emailKey(email));
  }

  private sweep(now: number): void {
    for (const key of this.failures.keys()) this.recent(key, now);
  }

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter(
      (at) => now - at < WINDOW_MS,
    );
    if (kept.length === 0) this.failures.delete(key);
    return kept;
  }
}

function clientKey(email: string, ip: string): string {
  return `client:${email.toLowerCase()}|${ip}`;
}

function emailKey(email: string): string {
  return `email:${email.toLowerCase()}`;
}
