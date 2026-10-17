import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Tenant root. Every listing, seller, category and image belongs to exactly
 * one store, and every administrative query is scoped by `store_id`.
 */
@Entity({ name: "stores" })
export class Store {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ type: "text", unique: true })
  declare slug: string;

  @Column({ type: "text" })
  declare name: string;

  @Column({ type: "text", default: "" })
  declare headline: string;

  @Column({ type: "text", default: "" })
  declare intro: string;

  @Column({ type: "text", default: "pt-BR" })
  declare locale: string;

  @Column({ type: "text", default: "BRL" })
  declare currency: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
