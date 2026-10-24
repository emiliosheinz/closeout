import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryFailedError } from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { TOO_MANY_ATTEMPTS } from "@/auth/services/auth.service";
import { hashPassword } from "@/auth/services/passwords";
import {
  hashToken,
  newRawToken,
  SessionsService,
} from "@/auth/services/sessions.service";
import { SlidingWindowCounter } from "@/security/sliding-window";
import type { AssignableRole } from "@/stores/entities/store-member.entity";
import {
  type ProvisionedMember,
  provisionMember,
} from "@/stores/member-provisioning";
import type { MembershipContext } from "@/stores/membership";

/** Postgres interval: issue or regeneration time plus seven days. */
const INVITE_LIFETIME = "168 hours";
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_INVALID_ATTEMPTS = 10;

const HAS_ACCOUNT = "Este e-mail já tem uma conta.";
const INVITE_INVALID =
  "Este convite é inválido ou expirou. Peça um novo link a quem convidou você.";
const INVITE_NOT_FOUND = "Convite não encontrado.";
const SIGN_IN_INSTEAD =
  "Sua conta foi criada, mas não foi possível entrar. Entre com seu e-mail e senha.";

export interface InviteSummary {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: string;
}

/** The raw link exists only in this response; the API keeps its hash. */
export interface IssuedInvite {
  invite: InviteSummary;
  link: string;
}

export interface InviteDetails {
  storeName: string;
  email: string;
  role: AssignableRole;
}

export interface AcceptInput {
  token: string;
  /** Already trimmed and non-empty. */
  name: string;
  password: string;
  /** International digits, or null/undefined for none. */
  whatsappNumber?: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: Date;
}

type AcceptOutcome =
  | "invalid"
  | "has-account"
  | (ProvisionedMember & { storeId: string });

const RETURNING = `id, email, role, expires_at AS "expiresAt"`;

/**
 * Invitations to join a store. A row exists only while its invite is
 * pending: accepting, revoking or re-inviting the email deletes or replaces
 * it, so every invalid link is simply "no unexpired row with that hash".
 */
@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  /** Invalid-link attempts per client IP, lookups and accepts together. */
  private readonly attempts = new SlidingWindowCounter(ATTEMPT_WINDOW_MS);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sessions: SessionsService,
  ) {}

  /** `email` is already parsed. Replaces any pending invite for it. */
  async create(
    actor: MembershipContext,
    email: string,
    role: AssignableRole,
  ): Promise<IssuedInvite> {
    if (
      await this.dataSource.getRepository(User).exists({ where: { email } })
    ) {
      throw new ConflictException(HAS_ACCOUNT);
    }
    await this.dataSource.query(
      `DELETE FROM store_invites WHERE store_id = $1 AND expires_at <= now()`,
      [actor.storeId],
    );
    const token = newRawToken();
    const [row] = await this.dataSource.query<InviteRow[]>(
      `INSERT INTO store_invites (store_id, email, role, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, now() + $5::interval)
       ON CONFLICT (store_id, email) DO UPDATE
         SET role = EXCLUDED.role,
             token_hash = EXCLUDED.token_hash,
             expires_at = EXCLUDED.expires_at,
             updated_at = now()
       RETURNING ${RETURNING}`,
      [actor.storeId, email, role, hashToken(token), INVITE_LIFETIME],
    );
    if (!row) throw new Error("Invite upsert returned no row");
    this.logger.log(
      `Invite ${row.id} for ${email} as ${role} created in store ${actor.storeId} by ${actor.userId}`,
    );
    return { invite: toSummary(row), link: inviteLink(token) };
  }

  /** Pending, unexpired invites; never their links. */
  async list(storeId: string): Promise<InviteSummary[]> {
    const rows = await this.dataSource.query<InviteRow[]>(
      `SELECT ${RETURNING} FROM store_invites
        WHERE store_id = $1 AND expires_at > now()
        ORDER BY created_at, id`,
      [storeId],
    );
    return rows.map(toSummary);
  }

  async revoke(actor: MembershipContext, id: string): Promise<void> {
    const [rows] = await this.dataSource.query<[InviteRow[], number]>(
      `DELETE FROM store_invites
        WHERE id = $1 AND store_id = $2 AND expires_at > now()
       RETURNING ${RETURNING}`,
      [id, actor.storeId],
    );
    const [row] = rows;
    if (!row) throw new NotFoundException(INVITE_NOT_FOUND);
    this.logger.log(
      `Invite ${row.id} for ${row.email} revoked in store ${actor.storeId} by ${actor.userId}`,
    );
  }

  /** New link and expiry; the previous link stops working. */
  async regenerate(
    actor: MembershipContext,
    id: string,
  ): Promise<IssuedInvite> {
    const token = newRawToken();
    const [rows] = await this.dataSource.query<[InviteRow[], number]>(
      `UPDATE store_invites
          SET token_hash = $3, expires_at = now() + $4::interval, updated_at = now()
        WHERE id = $1 AND store_id = $2 AND expires_at > now()
       RETURNING ${RETURNING}`,
      [id, actor.storeId, hashToken(token), INVITE_LIFETIME],
    );
    const [row] = rows;
    if (!row) throw new NotFoundException(INVITE_NOT_FOUND);
    this.logger.log(
      `Invite ${row.id} for ${row.email} regenerated in store ${actor.storeId} by ${actor.userId}`,
    );
    return { invite: toSummary(row), link: inviteLink(token) };
  }

  /** What the accept page shows for a valid link. */
  async lookup(token: string, clientIp: string): Promise<InviteDetails> {
    this.beginAttempt(clientIp);
    const [details] = await this.dataSource.query<InviteDetails[]>(
      `SELECT s.name AS "storeName", i.email, i.role
         FROM store_invites i JOIN stores s ON s.id = i.store_id
        WHERE i.token_hash = $1 AND i.expires_at > now()`,
      [hashToken(token)],
    );
    if (!details) throw new NotFoundException(INVITE_INVALID);
    this.attempts.forgetLatest(clientIp);
    return details;
  }

  /**
   * Consume the invite and create its member. Exactly one of several
   * concurrent accepts of a link can delete its row, so only one account is
   * created; the others see an invalid link.
   */
  async accept(
    input: AcceptInput,
    clientIp: string,
  ): Promise<{ sessionToken: string; expiresAt: Date }> {
    this.beginAttempt(clientIp);
    const tokenHash = hashToken(input.token);
    // Spares the slow password hash for links that are already invalid.
    const [pending] = await this.dataSource.query(
      `SELECT 1 FROM store_invites WHERE token_hash = $1 AND expires_at > now()`,
      [tokenHash],
    );
    if (!pending) throw new NotFoundException(INVITE_INVALID);

    const passwordHash = await hashPassword(input.password);
    const outcome = await this.consumeOrHasAccount(
      tokenHash,
      input,
      passwordHash,
    );
    if (outcome === "invalid") throw new NotFoundException(INVITE_INVALID);
    this.attempts.forgetLatest(clientIp);
    if (outcome === "has-account") throw new ConflictException(HAS_ACCOUNT);

    this.logger.log(
      `Invite accepted: user ${outcome.userId} joined store ${outcome.storeId} as ${outcome.role}`,
    );
    // Minted after commit: the sessions service writes on its own
    // connection, which could not see the uncommitted user.
    try {
      const { rawToken, expiresAt } = await this.sessions.mint(outcome.userId);
      return { sessionToken: rawToken, expiresAt };
    } catch (err) {
      this.logger.error(`Session mint failed for user ${outcome.userId}`, err);
      throw new InternalServerErrorException(SIGN_IN_INSTEAD);
    }
  }

  /**
   * {@link consume}, except that an email turned into a user between its
   * check and the insert (a unique violation, which rolled the deletion
   * back) consumes the invite and reports an existing account, as the
   * check itself would have.
   */
  private async consumeOrHasAccount(
    tokenHash: string,
    input: AcceptInput,
    passwordHash: string,
  ): Promise<AcceptOutcome> {
    try {
      return await this.consume(tokenHash, input, passwordHash);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      await this.dataSource.query(
        `DELETE FROM store_invites WHERE token_hash = $1`,
        [tokenHash],
      );
      return "has-account";
    }
  }

  private consume(
    tokenHash: string,
    input: AcceptInput,
    passwordHash: string,
  ): Promise<AcceptOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const [rows] = await manager.query<
        [{ storeId: string; email: string; role: AssignableRole }[], number]
      >(
        `DELETE FROM store_invites
          WHERE token_hash = $1 AND expires_at > now()
         RETURNING store_id AS "storeId", email, role`,
        [tokenHash],
      );
      const [invite] = rows;
      if (!invite) return "invalid" as const;
      if (
        await manager
          .getRepository(User)
          .exists({ where: { email: invite.email } })
      ) {
        return "has-account" as const;
      }
      const member = await provisionMember(manager, {
        storeId: invite.storeId,
        email: invite.email,
        name: input.name,
        passwordHash,
        whatsappNumber: input.whatsappNumber ?? null,
        role: invite.role,
      });
      return { ...member, storeId: invite.storeId };
    });
  }

  /**
   * Counts the attempt as invalid up front, so a burst cannot slip past
   * the limit while the first ones run; valid outcomes give it back.
   */
  private beginAttempt(clientIp: string): void {
    if (this.attempts.count(clientIp) >= MAX_INVALID_ATTEMPTS) {
      this.logger.warn(`Invite attempts rate limited for ${clientIp}`);
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.attempts.record(clientIp);
  }
}

function inviteLink(token: string): string {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error("PUBLIC_BASE_URL must be set");
  return `${base.replace(/\/+$/, "")}/invite/${token}`;
}

function toSummary(row: InviteRow): InviteSummary {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    expiresAt: new Date(row.expiresAt).toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string }).code === "23505"
  );
}
