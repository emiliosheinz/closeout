import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Server-side session. `tokenHash` is the SHA-256 of the opaque cookie value,
 * so a database read alone cannot impersonate an administrator.
 */
@Entity({ name: "sessions" })
@Index("sessions_user_idx", ["userId"])
export class Session {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ name: "token_hash", type: "text", unique: true })
  declare tokenHash: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  declare expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  declare revokedAt: Date | null;
}
