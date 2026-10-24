import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  type EntityManager,
  IsNull,
  LessThanOrEqual,
  Not,
  type Repository,
} from "typeorm";
import { Session } from "../entities/session.entity";
import { SESSION_DURATION_MS } from "../session-cookie";

const RAW_TOKEN_BYTES = 32;

/**
 * Opaque server-side sessions. The raw token is returned to the caller once
 * and only its SHA-256 hash is stored.
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
  ) {}

  async mint(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = newRawToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    await this.sessions.delete([
      { userId, expiresAt: LessThanOrEqual(now) },
      { userId, revokedAt: Not(IsNull()) },
    ]);
    await this.sessions.save({
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      revokedAt: null,
    });
    return { rawToken, expiresAt };
  }

  async findActiveByRawToken(rawToken: string): Promise<Session | null> {
    const session = await this.sessions.findOne({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { revokedAt: new Date() });
  }

  /** Pass a transactional manager to revoke as part of a wider change. */
  async revokeAllForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const sessions = manager?.getRepository(Session) ?? this.sessions;
    await sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}

/** A fresh opaque token: 32 CSPRNG bytes, base64url. Store only its hash. */
export function newRawToken(): string {
  return randomBytes(RAW_TOKEN_BYTES).toString("base64url");
}

/** The SHA-256 hex digest stored in place of a raw token. */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
