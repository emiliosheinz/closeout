import { MigrationInterface, QueryRunner } from "typeorm";

export class ImagePositionAndPublishedDate1792251747372
  implements MigrationInterface
{
  name = "ImagePositionAndPublishedDate1792251747372";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "listings_published_has_date" CHECK ("publication" <> 'published' OR "published_at" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_images" ADD CONSTRAINT "listing_images_listing_position_uq" UNIQUE ("listing_id", "position") DEFERRABLE INITIALLY DEFERRED`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "listing_images" DROP CONSTRAINT "listing_images_listing_position_uq"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "listings_published_has_date"`,
    );
  }
}
