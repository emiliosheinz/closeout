import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792251267804 implements MigrationInterface {
  name = "InitialSchema1792251267804";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions are not part of the entity diff, so the generator cannot
    // emit them: uuid-ossp backs the uuid defaults, citext the email
    // column, unaccent the accent-insensitive catalog search.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" citext NOT NULL, "name" text NOT NULL, "password_hash" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sessions_user_idx" ON "sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "stores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" text NOT NULL, "name" text NOT NULL, "headline" text NOT NULL DEFAULT '', "intro" text NOT NULL DEFAULT '', "locale" text NOT NULL DEFAULT 'pt-BR', "currency" text NOT NULL DEFAULT 'BRL', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_790b2968701a6ff5ff383237765" UNIQUE ("slug"), CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sellers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "user_id" uuid, "display_name" text NOT NULL, "whatsapp_number" text, "avatar_key" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "sellers_whatsapp_number_valid" CHECK ("whatsapp_number" IS NULL OR "whatsapp_number" ~ '^[1-9][0-9]{7,14}$'), CONSTRAINT "PK_97337ccbf692c58e6c7682de8a2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "sellers_store_idx" ON "sellers" ("store_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "slug" text NOT NULL, "name" text NOT NULL, "position" integer NOT NULL, CONSTRAINT "categories_store_slug_uq" UNIQUE ("store_id", "slug"), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "listing_images" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "listing_id" uuid NOT NULL, "storage_key" uuid NOT NULL, "position" integer NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f30343c5eadeb944b7d866d0ccc" UNIQUE ("storage_key"), CONSTRAINT "PK_2abb5c9d795f27dbc4b10ced9dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "listing_images_listing_idx" ON "listing_images" ("listing_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TABLE "listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "store_id" uuid NOT NULL, "seller_id" uuid NOT NULL, "category_id" uuid NOT NULL, "slug" text NOT NULL, "title" text NOT NULL, "description" text NOT NULL DEFAULT '', "price_cents" integer, "condition" text NOT NULL, "availability" text NOT NULL DEFAULT 'available', "publication" text NOT NULL DEFAULT 'draft', "attributes" jsonb NOT NULL DEFAULT '[]'::jsonb, "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "listings_store_slug_uq" UNIQUE ("store_id", "slug"), CONSTRAINT "listings_price_non_negative" CHECK ("price_cents" IS NULL OR "price_cents" >= 0), CONSTRAINT "listings_publication_valid" CHECK ("publication" IN ('draft', 'published', 'archived')), CONSTRAINT "listings_availability_valid" CHECK ("availability" IN ('available', 'reserved', 'sold')), CONSTRAINT "listings_condition_valid" CHECK ("condition" IN ('new', 'like_new', 'good', 'fair', 'for_parts')), CONSTRAINT "PK_520ecac6c99ec90bcf5a603cdcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "listings_seller_idx" ON "listings" ("seller_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "listings_category_idx" ON "listings" ("store_id", "category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "listings_public_idx" ON "listings" ("store_id", "publication", "availability", "published_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "store_members" ("store_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "store_members_role_valid" CHECK ("role" IN ('owner', 'admin')), CONSTRAINT "PK_e119dedd3232bbe7db331e06732" PRIMARY KEY ("store_id", "user_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "FK_909701cd0ce4a1f3aedd823ccfb" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" ADD CONSTRAINT "FK_83f4670f0e114d0be3731bade87" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_5848ba82e61b83e2aa416447a15" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_images" ADD CONSTRAINT "FK_13e6e104770a7e943fdd0e5f266" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_images" ADD CONSTRAINT "FK_94041359df3c1b14c4420808d16" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "FK_6c1606ce6a8364f699a85f8b485" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" ADD CONSTRAINT "FK_9315deed3e8f6d9171c23131418" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "FK_ca3fefdd99c1f2714119479c28c" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" ADD CONSTRAINT "FK_e9a006e2fe10bd3fb7b0fad33d1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "FK_e9a006e2fe10bd3fb7b0fad33d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "store_members" DROP CONSTRAINT "FK_ca3fefdd99c1f2714119479c28c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "FK_9315deed3e8f6d9171c23131418"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "FK_6d2846ee6b337ce5225c8c7286b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listings" DROP CONSTRAINT "FK_6c1606ce6a8364f699a85f8b485"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_images" DROP CONSTRAINT "FK_94041359df3c1b14c4420808d16"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listing_images" DROP CONSTRAINT "FK_13e6e104770a7e943fdd0e5f266"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_5848ba82e61b83e2aa416447a15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "FK_83f4670f0e114d0be3731bade87"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sellers" DROP CONSTRAINT "FK_909701cd0ce4a1f3aedd823ccfb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19"`,
    );
    await queryRunner.query(`DROP TABLE "store_members"`);
    await queryRunner.query(`DROP INDEX "public"."listings_public_idx"`);
    await queryRunner.query(`DROP INDEX "public"."listings_category_idx"`);
    await queryRunner.query(`DROP INDEX "public"."listings_seller_idx"`);
    await queryRunner.query(`DROP TABLE "listings"`);
    await queryRunner.query(`DROP INDEX "public"."listing_images_listing_idx"`);
    await queryRunner.query(`DROP TABLE "listing_images"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP INDEX "public"."sellers_store_idx"`);
    await queryRunner.query(`DROP TABLE "sellers"`);
    await queryRunner.query(`DROP TABLE "stores"`);
    await queryRunner.query(`DROP INDEX "public"."sessions_user_idx"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
