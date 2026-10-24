import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";
import type { StoreRole } from "../roles";
import { Store } from "./store.entity";

export {
  ASSIGNABLE_ROLES,
  type AssignableRole,
  STORE_ROLES,
  type StoreRole,
} from "../roles";

/**
 * Grants a user access to one store with exactly one role. Each store has at
 * most one owner.
 */
@Entity({ name: "store_members" })
@Check("store_members_role_valid", `"role" IN ('owner', 'admin', 'seller')`)
@Index("store_members_one_owner_uq", ["storeId"], {
  unique: true,
  where: `"role" = 'owner'`,
})
export class StoreMember {
  @PrimaryColumn({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @PrimaryColumn({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ type: "text" })
  declare role: StoreRole;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;
}
