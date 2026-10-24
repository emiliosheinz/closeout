import { MigrationInterface, QueryRunner } from "typeorm";

export class MembersOwnContactProfiles1792802868935
  implements MigrationInterface
{
  name = "MembersOwnContactProfiles1792802868935";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hand-written data prelude: afterwards every member has exactly one
    // contact profile and every profile belongs to a member of its store.
    const blocked: { slug: string; owners: number }[] = await queryRunner.query(
      `SELECT "slug", "owners" FROM (SELECT s."slug", (SELECT COUNT(*)::int FROM "store_members" m WHERE m."store_id" = s."id" AND m."role" = 'owner') AS "owners", EXISTS (SELECT 1 FROM "listings" l WHERE l."store_id" = s."id") AS "has_listings" FROM "stores" s) t WHERE "owners" > 1 OR ("owners" = 0 AND "has_listings") ORDER BY "slug"`,
    );
    if (blocked.length > 0) {
      const reasons = blocked.map(({ slug, owners }) =>
        owners > 1
          ? `store "${slug}" has more than one owner`
          : `store "${slug}" has listings but no owner`,
      );
      throw new Error(
        `Cannot migrate: ${reasons.join("; ")}. Give each such store exactly one owner, or reset the database, then migrate again.`,
      );
    }
    // Members without a contact profile get one from their name, without WhatsApp.
    await queryRunner.query(
      `INSERT INTO "sellers" ("store_id", "user_id", "display_name") SELECT m."store_id", m."user_id", u."name" FROM "store_members" m JOIN "users" u ON u."id" = m."user_id" WHERE NOT EXISTS (SELECT 1 FROM "sellers" s WHERE s."store_id" = m."store_id" AND s."user_id" = m."user_id")`,
    );
    // A member's duplicate profiles hand their listings to the oldest one.
    await queryRunner.query(
      `WITH ranked AS (SELECT "id", first_value("id") OVER (PARTITION BY "store_id", "user_id" ORDER BY "created_at", "id") AS "kept" FROM "sellers" WHERE "user_id" IS NOT NULL) INSERT INTO "listing_sellers" ("listing_id", "seller_id") SELECT ls."listing_id", r."kept" FROM "listing_sellers" ls JOIN ranked r ON r."id" = ls."seller_id" WHERE r."id" <> r."kept" ON CONFLICT DO NOTHING`,
    );
    // Loginless, non-member and duplicate profiles go; their listing_sellers rows cascade.
    await queryRunner.query(
      `DELETE FROM "sellers" s WHERE s."user_id" IS NULL OR NOT EXISTS (SELECT 1 FROM "store_members" m WHERE m."store_id" = s."store_id" AND m."user_id" = s."user_id") OR EXISTS (SELECT 1 FROM "sellers" o WHERE o."store_id" = s."store_id" AND o."user_id" = s."user_id" AND (o."created_at", o."id") < (s."created_at", s."id"))`,
    );
    // Listings left without any seller go to the store owner's profile.
    await queryRunner.query(
      `INSERT INTO "listing_sellers" ("listing_id", "seller_id") SELECT l."id", s."id" FROM "listings" l JOIN "store_members" m ON m."store_id" = l."store_id" AND m."role" = 'owner' JOIN "sellers" s ON s."store_id" = m."store_id" AND s."user_id" = m."user_id" WHERE NOT EXISTS (SELECT 1 FROM "listing_sellers" ls WHERE ls."listing_id" = l."id")`,
    );
    // Hand-written: TypeORM does not diff a changed CHECK expression.
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "store_members_role_valid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "store_members_role_valid" CHECK ("role" IN ('owner', 'admin', 'seller'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "FK_83f4670f0e114d0be3731bade87"`,
    );
    await queryRunner.query(
      `CREATE TABLE "store_invites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "email" citext NOT NULL, "role" text NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7fbccc7f75fd346edd84f2b00a8" UNIQUE ("token_hash"), CONSTRAINT "store_invites_store_email_uq" UNIQUE ("store_id", "email"), CONSTRAINT "store_invites_role_valid" CHECK ("role" IN ('admin', 'seller')), CONSTRAINT "PK_a43d41e11dbeb2f273a1761ddf9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ALTER COLUMN "user_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "store_members_one_owner_uq" ON "store_members" ("store_id") WHERE "role" = 'owner'`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "sellers_store_user_uq" UNIQUE ("store_id", "user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "FK_83f4670f0e114d0be3731bade87" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_invites" ADD CONSTRAINT "FK_afebf89132f772c7a8327b14a05" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_invites" DROP CONSTRAINT "FK_afebf89132f772c7a8327b14a05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "FK_83f4670f0e114d0be3731bade87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "sellers_store_user_uq"`,
    );
    await queryRunner.query(`DROP INDEX "public"."store_members_one_owner_uq"`);
    await queryRunner.query(
      `ALTER TABLE "sellers" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "store_invites"`);
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "FK_83f4670f0e114d0be3731bade87" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Hand-written: fails while any member holds the seller role.
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "store_members_role_valid"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "store_members_role_valid" CHECK ("role" IN ('owner', 'admin'))`,
    );
  }
}
