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

/**
 * Someone a store sells to. Unique per store by `nameKey`, the normalized
 * form of the name that the application computes on every write.
 * `whatsappNumber` holds international digits only, like a seller's.
 */
@Entity({ name: "buyers" })
@Unique("buyers_store_name_key_uq", ["storeId", "nameKey"])
@Check(
  "buyers_whatsapp_number_valid",
  `"whatsapp_number" IS NULL OR "whatsapp_number" ~ '^[1-9][0-9]{7,14}$'`,
)
export class Buyer {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ type: "text" })
  declare name: string;

  @Column({ name: "name_key", type: "text" })
  declare nameKey: string;

  @Column({ name: "whatsapp_number", type: "text", nullable: true })
  declare whatsappNumber: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
