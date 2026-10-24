import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Store } from "@/stores/entities/store.entity";
import type { AssignableRole } from "@/stores/entities/store-member.entity";

/**
 * Pending invitation to join a store. The row exists only while the invite
 * is pending: accepting, revoking or replacing it deletes the row.
 * `tokenHash` is the SHA-256 of the raw link token, which is never stored.
 */
@Entity({ name: "store_invites" })
@Unique("store_invites_store_email_uq", ["storeId", "email"])
@Check("store_invites_role_valid", `"role" IN ('admin', 'seller')`)
export class StoreInvite {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ type: "citext" })
  declare email: string;

  @Column({ type: "text" })
  declare role: AssignableRole;

  @Column({ name: "token_hash", type: "text", unique: true })
  declare tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  declare expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
