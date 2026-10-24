const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Per-key event timestamps within a sliding time window. Keys with no
 * recent events are dropped, so memory stays bounded by active keys.
 *
 * ponytail: in-memory, so counts reset on restart and are not shared
 * between replicas. Move to a Postgres or Redis table before running more
 * than one API instance.
 */
export class SlidingWindowCounter {
  private readonly events = new Map<string, number[]>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(private readonly windowMs: number) {}

  /** Events recorded for `key` within the window ending at `now`. */
  count(key: string, now = Date.now()): number {
    return this.recent(key, now).length;
  }

  record(key: string, now = Date.now()): void {
    this.sweep(now);
    this.events.set(key, [...this.recent(key, now), now]);
  }

  /** Forget every event of `key`. */
  clear(key: string): void {
    this.events.delete(key);
  }

  /** Forget the most recent event of `key`. */
  forgetLatest(key: string, now = Date.now()): void {
    const remaining = this.recent(key, now).slice(0, -1);
    if (remaining.length > 0) this.events.set(key, remaining);
    else this.events.delete(key);
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const key of this.events.keys()) this.recent(key, now);
  }

  private recent(key: string, now: number): number[] {
    const kept = (this.events.get(key) ?? []).filter(
      (at) => now - at < this.windowMs,
    );
    if (kept.length === 0) this.events.delete(key);
    return kept;
  }
}
