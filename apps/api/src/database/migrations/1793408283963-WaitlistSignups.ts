import { MigrationInterface, QueryRunner } from "typeorm";

export class WaitlistSignups1793408283963 implements MigrationInterface {
  name = "WaitlistSignups1793408283963";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "waitlist_signups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "channel" text NOT NULL, "contact" text NOT NULL, "ref" text, "src" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "waitlist_signups_contact_uq" UNIQUE ("contact"), CONSTRAINT "waitlist_signups_src_valid" CHECK ("src" IS NULL OR "src" IN ('catalog-footer', 'landing', 'login')), CONSTRAINT "waitlist_signups_channel_valid" CHECK ("channel" IN ('whatsapp', 'email')), CONSTRAINT "PK_2c25d8edf518162f06c849c5fb3" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "waitlist_signups"`);
  }
}
