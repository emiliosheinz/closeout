import type {
  WaitlistChannel,
  WaitlistPlacement,
} from "@closeout/contracts/enums";
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

/**
 * Someone who asked to be told when closeout opens to new stores. `contact`
 * is stored normalized (digits for WhatsApp, lowercased for e-mail), so one
 * contact has one row. `ref` is the store the visitor came from, kept as
 * plain text so it outlives that store.
 */
@Entity({ name: "waitlist_signups" })
@Unique("waitlist_signups_contact_uq", ["contact"])
@Check("waitlist_signups_channel_valid", `"channel" IN ('whatsapp', 'email')`)
@Check(
  "waitlist_signups_src_valid",
  `"src" IS NULL OR "src" IN ('catalog-footer', 'landing', 'login')`,
)
export class WaitlistSignup {
  @PrimaryGeneratedColumn("uuid")
  declare id: string;

  @Column({ type: "text" })
  declare name: string;

  @Column({ type: "text" })
  declare channel: WaitlistChannel;

  @Column({ type: "text" })
  declare contact: string;

  @Column({ type: "text", nullable: true })
  declare ref: string | null;

  @Column({ type: "text", nullable: true })
  declare src: WaitlistPlacement | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  declare createdAt: Date;
}
