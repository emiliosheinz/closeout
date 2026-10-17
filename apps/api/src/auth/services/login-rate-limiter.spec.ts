import { LoginRateLimiter } from "./login-rate-limiter";

const MINUTE = 60 * 1000;

describe("LoginRateLimiter", () => {
  it("blocks the 11th attempt after ten failures from one client", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 9; i++) limiter.recordFailure("a@x.com", "1.1.1.1", 0);
    expect(limiter.isBlocked("a@x.com", "1.1.1.1", 0)).toBe(false);
    limiter.recordFailure("a@x.com", "1.1.1.1", 0);
    expect(limiter.isBlocked("a@x.com", "1.1.1.1", 0)).toBe(true);
    expect(limiter.isBlocked("a@x.com", "2.2.2.2", 0)).toBe(false);
  });

  it("unblocks once the 15 minute window has passed", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 10; i++) limiter.recordFailure("a@x.com", "ip", 0);
    expect(limiter.isBlocked("a@x.com", "ip", 15 * MINUTE - 1)).toBe(true);
    expect(limiter.isBlocked("a@x.com", "ip", 15 * MINUTE)).toBe(false);
  });

  it("blocks an email after thirty failures spread across clients", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure("A@x.com", `10.0.0.${i}`, 0);
    }
    expect(limiter.isBlocked("a@x.com", "10.9.9.9", 0)).toBe(true);
  });

  it("clears the client counter after a successful login", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 9; i++) limiter.recordFailure("a@x.com", "ip", 0);
    limiter.recordFailure("a@x.com", "ip", 0);
    limiter.forgiveSuccess("a@x.com", "ip", 0);
    expect(limiter.isBlocked("a@x.com", "ip", 0)).toBe(false);
  });

  it("does not count successful logins against the email budget", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure("a@x.com", `10.0.0.${i}`, 0);
      limiter.forgiveSuccess("a@x.com", `10.0.0.${i}`, 0);
    }
    expect(limiter.isBlocked("a@x.com", "10.9.9.9", 0)).toBe(false);
  });

  it("blocks one IP after thirty failures across rotating emails", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 29; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(limiter.isBlocked("new@x.com", "9.9.9.9", 0)).toBe(false);
    limiter.recordFailure("u30@x.com", "9.9.9.9", 0);
    expect(limiter.isBlocked("fresh@x.com", "9.9.9.9", 0)).toBe(true);
    expect(limiter.isBlocked("fresh@x.com", "8.8.8.8", 0)).toBe(false);
  });

  it("unblocks an IP once the window has passed", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(limiter.isBlocked("x@x.com", "9.9.9.9", 15 * MINUTE - 1)).toBe(true);
    expect(limiter.isBlocked("x@x.com", "9.9.9.9", 15 * MINUTE)).toBe(false);
  });

  it("does not count successful logins against the IP budget", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
      limiter.forgiveSuccess(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(limiter.isBlocked("x@x.com", "9.9.9.9", 0)).toBe(false);
  });
});
