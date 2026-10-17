import { MigrationInterface, QueryRunner } from "typeorm";

export class MultipleSellersPerListing1792262257411
  implements MigrationInterface
{
  name = "MultipleSellersPerListing1792262257411";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b"`,
    );
    await queryRunner.query(`DROP INDEX "public"."listings_seller_idx"`);
    await queryRunner.query(
      `CREATE TABLE "listing_sellers" ("listing_id" uuid NOT NULL, "seller_id" uuid NOT NULL, CONSTRAINT "PK_d4d2c9622723ae577f36ea1ff8e" PRIMARY KEY ("listing_id", "seller_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "listing_sellers_seller_idx" ON "listing_sellers" ("seller_id") `,
    );
    // Hand-written: every listing keeps the seller it had.
    await queryRunner.query(
      `INSERT INTO "listing_sellers" ("listing_id", "seller_id") SELECT "id", "seller_id" FROM "listings"`,
    );
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "seller_id"`);
    await queryRunner.query(
      `ALTER TABLE "listing_sellers" ADD CONSTRAINT "FK_d7c1ff0afcd0313c2bebf812d07" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_sellers" ADD CONSTRAINT "FK_3d95d9a1800bbcd8f9d7df536ea" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listing_sellers" DROP CONSTRAINT "FK_3d95d9a1800bbcd8f9d7df536ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_sellers" DROP CONSTRAINT "FK_d7c1ff0afcd0313c2bebf812d07"`,
    );
    // Hand-written: a shared listing keeps its alphabetically first seller.
    await queryRunner.query(`ALTER TABLE "listings" ADD "seller_id" uuid`);
    await queryRunner.query(
      `UPDATE "listings" l SET "seller_id" = first."seller_id" FROM (SELECT DISTINCT ON (ls."listing_id") ls."listing_id", ls."seller_id" FROM "listing_sellers" ls JOIN "sellers" s ON s."id" = ls."seller_id" ORDER BY ls."listing_id", s."display_name", s."id") first WHERE first."listing_id" = l."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ALTER COLUMN "seller_id" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "public"."listing_sellers_seller_idx"`);
    await queryRunner.query(`DROP TABLE "listing_sellers"`);
    await queryRunner.query(
      `CREATE INDEX "listings_seller_idx" ON "listings" ("seller_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
