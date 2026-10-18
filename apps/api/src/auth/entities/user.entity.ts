import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Store administrator. Created only by the operator CLI; there is no
 * self-registration endpoint. `passwordHash` is a self-describing scrypt
 * string (see `passwords.ts`) and never leaves the API.
 */
@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ type: "citext", unique: true })
  declare email: string;

  @Column({ type: "text", nullable: true })
  declare driftProbe: string | null;

  @Column({ type: "text" })
  declare name: string;

  @Column({ name: "password_hash", type: "text" })
  declare passwordHash: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  declare updatedAt: Date;
}
