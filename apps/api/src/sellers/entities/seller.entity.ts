import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "@/auth/entities/user.entity";
import { Store } from "@/stores/entities/store.entity";

/**
 * Public contact profile buyers reach on WhatsApp. Optionally linked to the
 * administrator it represents. `whatsappNumber` holds international digits
 * only (no `+`), the exact form `wa.me` expects.
 */
@Entity({ name: "sellers" })
@Index("sellers_store_idx", ["storeId"])
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

  @Column({ name: "user_id", type: "uuid", nullable: true })
  declare userId: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "user_id" })
  declare user: User | null;

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
