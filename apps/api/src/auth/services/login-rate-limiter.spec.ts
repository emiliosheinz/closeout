import { LoginRateLimiter } from "./login-rate-limiter";

const MINUTE = 60 * 1000;

describe("LoginRateLimiter", () => {
  it("blocks the 11th attempt after ten failures from one client", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 9; i++) limiter.recordFailure("a@x.com", "1.1.1.1", 0);
    expect(limiter.blockedFor("a@x.com", "1.1.1.1", 0)).toBeUndefined();
    limiter.recordFailure("a@x.com", "1.1.1.1", 0);
    expect(limiter.blockedFor("a@x.com", "1.1.1.1", 0)).toBeDefined();
    expect(limiter.blockedFor("a@x.com", "2.2.2.2", 0)).toBeUndefined();
  });

  it("unblocks once the 15 minute window has passed", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 10; i++) limiter.recordFailure("a@x.com", "ip", 0);
    expect(limiter.blockedFor("a@x.com", "ip", 15 * MINUTE - 1)).toBeDefined();
    expect(limiter.blockedFor("a@x.com", "ip", 15 * MINUTE)).toBeUndefined();
  });

  it("blocks an email after thirty failures spread across clients", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 29; i++) {
      limiter.recordFailure("A@x.com", `10.0.0.${i}`, 0);
    }
    expect(limiter.blockedFor("a@x.com", "10.9.9.9", 0)).toBeUndefined();
    limiter.recordFailure("a@x.com", "10.0.0.29", 0);
    expect(limiter.blockedFor("a@x.com", "10.9.9.9", 0)).toBeDefined();
  });

  it("clears the client counter after a successful login", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 9; i++) limiter.recordFailure("a@x.com", "ip", 0);
    limiter.recordFailure("a@x.com", "ip", 0);
    limiter.forgiveSuccess("a@x.com", "ip", 0);
    expect(limiter.blockedFor("a@x.com", "ip", 0)).toBeUndefined();
  });

  it("does not count successful logins against the email budget", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure("a@x.com", `10.0.0.${i}`, 0);
      limiter.forgiveSuccess("a@x.com", `10.0.0.${i}`, 0);
    }
    expect(limiter.blockedFor("a@x.com", "10.9.9.9", 0)).toBeUndefined();
  });

  it("keeps counting other failures on the email after a successful login", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 29; i++) {
      limiter.recordFailure("a@x.com", `10.0.0.${i}`, 0);
    }
    limiter.recordFailure("a@x.com", "10.0.1.1", 0);
    limiter.forgiveSuccess("a@x.com", "10.0.1.1", 0);
    expect(limiter.blockedFor("a@x.com", "10.9.9.9", 0)).toBeUndefined();
    limiter.recordFailure("a@x.com", "10.0.1.2", 0);
    expect(limiter.blockedFor("a@x.com", "10.9.9.9", 0)).toBeDefined();
  });

  it("blocks one IP after thirty failures across rotating emails", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 29; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(limiter.blockedFor("new@x.com", "9.9.9.9", 0)).toBeUndefined();
    limiter.recordFailure("u30@x.com", "9.9.9.9", 0);
    expect(limiter.blockedFor("fresh@x.com", "9.9.9.9", 0)).toBeDefined();
    expect(limiter.blockedFor("fresh@x.com", "8.8.8.8", 0)).toBeUndefined();
  });

  it("unblocks an IP once the window has passed", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(
      limiter.blockedFor("x@x.com", "9.9.9.9", 15 * MINUTE - 1),
    ).toBeDefined();
    expect(
      limiter.blockedFor("x@x.com", "9.9.9.9", 15 * MINUTE),
    ).toBeUndefined();
  });

  it("does not count successful logins against the IP budget", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
      limiter.forgiveSuccess(`u${i}@x.com`, "9.9.9.9", 0);
    }
    expect(limiter.blockedFor("x@x.com", "9.9.9.9", 0)).toBeUndefined();
  });

  it("keeps counting other failures on the IP after a successful login", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 29; i++) {
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 0);
    }
    limiter.recordFailure("owner@x.com", "9.9.9.9", 0);
    limiter.forgiveSuccess("owner@x.com", "9.9.9.9", 0);
    expect(limiter.blockedFor("x@x.com", "9.9.9.9", 0)).toBeUndefined();
    limiter.recordFailure("u29@x.com", "9.9.9.9", 0);
    expect(limiter.blockedFor("x@x.com", "9.9.9.9", 0)).toBeDefined();
  });

  it("shares counts between emails that differ only in case", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure(i % 2 ? "Ana@X.com" : "ana@x.com", "ip", 0);
    }
    expect(limiter.blockedFor("ANA@x.COM", "ip", 0)).toBeDefined();
  });

  it("tells a blocked client to retry when its oldest counted failure expires", () => {
    const limiter = new LoginRateLimiter();
    limiter.recordFailure("a@x.com", "ip", 0);
    for (let i = 0; i < 9; i++) {
      limiter.recordFailure("a@x.com", "ip", 2 * MINUTE);
    }
    expect(limiter.blockedFor("a@x.com", "ip", 5 * MINUTE)).toBe(600);
    expect(limiter.blockedFor("a@x.com", "ip", 15 * MINUTE - 1)).toBe(1);
  });

  it("waits for the slowest of several exceeded limits", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 30; i++) {
      limiter.recordFailure("early@x.com", `10.0.0.${i}`, 0);
      limiter.recordFailure(`u${i}@x.com`, "9.9.9.9", 5 * MINUTE);
      limiter.recordFailure("late@x.com", `10.0.1.${i}`, 5 * MINUTE);
      limiter.recordFailure(`v${i}@x.com`, "8.8.8.8", 0);
    }
    const now = 5 * MINUTE;
    expect(limiter.blockedFor("early@x.com", "7.7.7.7", now)).toBe(600);
    expect(limiter.blockedFor("early@x.com", "9.9.9.9", now)).toBe(900);
    expect(limiter.blockedFor("late@x.com", "8.8.8.8", now)).toBe(900);
  });
});
