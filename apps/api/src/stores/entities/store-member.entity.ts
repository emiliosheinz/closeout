import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { Store } from "./store.entity";

export const STORE_ROLES = ["owner", "admin"] as const;
export type StoreRole = (typeof STORE_ROLES)[number];

/** Grants a user administrative access to one store. */
@Entity({ name: "store_members" })
@Check("store_members_role_valid", `"role" IN ('owner', 'admin')`)
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
