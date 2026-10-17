import { Injectable } from "@nestjs/common";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_CLIENT = 10;
const MAX_FAILURES_PER_EMAIL = 30;
const MAX_FAILURES_PER_IP = 30;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Sliding-window limiter for failed logins, keyed by `email|ip` (stops a
 * single client guessing), by email alone (stops distributed guessing at a
 * higher threshold) and by IP alone (stops one host rotating emails).
 *
 * ponytail: in-memory, so counters reset on restart and are not shared
 * between replicas. Move to a Postgres or Redis table before running more
 * than one API instance.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  isBlocked(email: string, ip: string, now = Date.now()): boolean {
    return (
      this.recent(clientKey(email, ip), now).length >=
        MAX_FAILURES_PER_CLIENT ||
      this.recent(emailKey(email), now).length >= MAX_FAILURES_PER_EMAIL ||
      this.recent(ipKey(ip), now).length >= MAX_FAILURES_PER_IP
    );
  }

  /**
   * Count an attempt as failed before the password is checked, so a burst
   * of concurrent requests cannot all slip past {@link isBlocked} while the
   * slow hash comparison runs. {@link forgiveSuccess} undoes it.
   */
  recordFailure(email: string, ip: string, now = Date.now()): void {
    this.sweep(now);
    for (const key of [clientKey(email, ip), emailKey(email), ipKey(ip)]) {
      this.failures.set(key, [...this.recent(key, now), now]);
    }
  }

  /** A successful login clears the client's counter and returns its attempt. */
  forgiveSuccess(email: string, ip: string, now = Date.now()): void {
    this.failures.delete(clientKey(email, ip));
    for (const key of [emailKey(email), ipKey(ip)]) {
      const remaining = this.recent(key, now).slice(0, -1);
      if (remaining.length > 0) this.failures.set(key, remaining);
      else this.failures.delete(key);
    }
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
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

function ipKey(ip: string): string {
  return `ip:${ip}`;
}
