import type { Repository } from "typeorm";
import type { Session } from "../entities/session.entity";
import { SessionsService } from "./sessions.service";

/** In-memory stand-in for the sessions table (the datastore boundary). */
function serviceWith(session: Partial<Session>): SessionsService {
  const repo = {
    findOne: async () => ({
      id: "s1",
      userId: "u1",
      revokedAt: null,
      ...session,
    }),
  } as unknown as Repository<Session>;
  return new SessionsService(repo);
}

describe("SessionsService.findActiveByRawToken", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");
  beforeAll(() => {
    vi.useFakeTimers({ now });
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("accepts a session that expires later", async () => {
    const service = serviceWith({ expiresAt: new Date(now.getTime() + 1) });
    expect(await service.findActiveByRawToken("t")).not.toBeNull();
  });

  it("rejects a session exactly at its expiry instant", async () => {
    const service = serviceWith({ expiresAt: new Date(now.getTime()) });
    expect(await service.findActiveByRawToken("t")).toBeNull();
  });

  it("rejects a revoked session", async () => {
    const service = serviceWith({
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: new Date(now.getTime() - 1),
    });
    expect(await service.findActiveByRawToken("t")).toBeNull();
  });
});
