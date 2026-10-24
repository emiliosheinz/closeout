import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { Store } from "@/stores/entities/store.entity";

/**
 * Public contact profile buyers reach on WhatsApp. Every store member has
 * exactly one, and it goes away with the member's account. `whatsappNumber`
 * holds international digits only (no `+`), the exact form `wa.me` expects.
 */
@Entity({ name: "sellers" })
@Index("sellers_store_idx", ["storeId"])
@Unique("sellers_store_user_uq", ["storeId", "userId"])
@Check(
  "sellers_whatsapp_number_valid",
  `"whatsapp_number" IS NULL OR "whatsapp_number" ~ '^[1-9][0-9]{7,14}$'`,
)
export class Seller {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ name: "user_id", type: "uuid" })
  declare userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  declare user: User;

  @Column({ name: "display_name", type: "text" })
  declare displayName: string;

  @Column({ name: "whatsapp_number", type: "text", nullable: true })
  declare whatsappNumber: string | null;

  @Column({ name: "avatar_key", type: "text", nullable: true })
  declare avatarKey: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
