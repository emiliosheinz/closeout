import { MigrationInterface, QueryRunner } from "typeorm";

export class BuyersAndSaleInfo1793461192669 implements MigrationInterface {
  name = "BuyersAndSaleInfo1793461192669";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "buyers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "name" text NOT NULL, "name_key" text NOT NULL, "whatsapp_number" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "buyers_store_name_key_uq" UNIQUE ("store_id", "name_key"), CONSTRAINT "buyers_whatsapp_number_valid" CHECK ("whatsapp_number" IS NULL OR "whatsapp_number" ~ '^[1-9][0-9]{7,14}$'), CONSTRAINT "PK_aff372821d05bac04a18ff8eb87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "listings" ADD "buyer_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "listings" ADD "agreed_price_cents" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD "paid" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "listings" ADD "sale_notes" text`);
    await queryRunner.query(
      `CREATE INDEX "listings_buyer_idx" ON "listings"  ("buyer_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "listings_sale_needs_buyer" CHECK ("buyer_id" IS NOT NULL OR ("agreed_price_cents" IS NULL AND "sale_notes" IS NULL AND "paid" = false))`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "listings_available_has_no_sale" CHECK ("availability" <> 'available' OR ("buyer_id" IS NULL AND "agreed_price_cents" IS NULL AND "sale_notes" IS NULL AND "paid" = false))`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "listings_agreed_price_valid" CHECK ("agreed_price_cents" IS NULL OR ("agreed_price_cents" >= 0 AND "agreed_price_cents" <= 100000000))`,
    );
    await queryRunner.query(
      `ALTER TABLE "buyers" ADD CONSTRAINT "FK_2aadd74fd7efaa009d19afea5ab" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "FK_6ddd2b576417b98a538e4250042" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "FK_6ddd2b576417b98a538e4250042"`,
    );
    await queryRunner.query(
      `ALTER TABLE "buyers" DROP CONSTRAINT "FK_2aadd74fd7efaa009d19afea5ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "listings_agreed_price_valid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "listings_available_has_no_sale"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "listings_sale_needs_buyer"`,
    );
    await queryRunner.query(`DROP INDEX "public"."listings_buyer_idx"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "sale_notes"`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "paid"`);
    await queryRunner.query(
      `ALTER TABLE "listings" DROP COLUMN "agreed_price_cents"`,
    );
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "buyer_id"`);
    await queryRunner.query(`DROP TABLE "buyers"`);
  }
}
