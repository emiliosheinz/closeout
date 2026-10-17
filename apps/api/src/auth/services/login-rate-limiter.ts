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

  recordFailure(email: string, ip: string, now = Date.now()): void {
    for (const key of [clientKey(email, ip), emailKey(email)]) {
      this.failures.set(key, [...this.recent(key, now), now]);
    }
  }

  reset(email: string, ip: string): void {
    this.failures.delete(clientKey(email, ip));
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
