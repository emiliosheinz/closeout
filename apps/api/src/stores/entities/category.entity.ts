import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Store } from "./store.entity";

/** Per-store category. Created with the store from a default set. */
@Entity({ name: "categories" })
@Unique("categories_store_slug_uq", ["storeId", "slug"])
export class Category {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ name: "store_id", type: "uuid" })
  declare storeId: string;

  @ManyToOne(() => Store, { onDelete: "CASCADE" })
  @JoinColumn({ name: "store_id" })
  declare store: Store;

  @Column({ type: "text" })
  declare slug: string;

  @Column({ type: "text" })
  declare name: string;

  @Column({ type: "int" })
  declare position: number;
}
